import { calcEMA, calcMAD } from "./quant-math.js";
import { DetectorHyperParams, TokenQuantState, QuantSignalResponse } from "./types.js";

function clampScore(score: number, maxAbsScore: number): number {
  if (!Number.isFinite(score)) return score;
  const safeMaxAbsScore = Number.isFinite(maxAbsScore) && maxAbsScore > 0
    ? maxAbsScore
    : 5;
  return Math.min(Math.max(score, -safeMaxAbsScore), safeMaxAbsScore);
}

//Phân tích tín hiệu alpha và chuẩn hóa chéo cho từng token
export function evaluateAlphaAndCross(
  tokenStates: Map<string, TokenQuantState>,//quant của token  
  historicalData: Record<string, any[]>,//Dữ liệu lịch sử của token
  hyperParams: DetectorHyperParams,//tham số điều chỉnh
  options: {
    dynamicBetaBySymbol?: Record<string, number>;
    //Tra cứu beta động cho từng token  
    marketRegime?: string;//TThai hiện tại
  } = {}
): Partial<QuantSignalResponse>[] {//out: mảng tín hiệu quant cuối cùng chỉ gồm token có tín hiệu mạnh
  

  // Z-Score & Beta (Time-Series Alpha)
  // Đo xem unifiedRaw hiện tại của token lệch
  // bao nhiêu so với lịch sử gần nhất của chính nó
  let btcTimeZ = 0;
  const finiteHistoryValuesBySymbol = new Map<string, number[]>();
  for (const [symbol, state] of tokenStates.entries()) {
    const historyValues = (historicalData[symbol] || [])
      .map(h => Number(h.unifiedRaw))
      .filter(value => Number.isFinite(value));
    finiteHistoryValuesBySymbol.set(symbol, historyValues);
    
    // Nếu token có ít hơn 3 điểm lịch sử (token mới)
    // thì timeZ = unifiedRaw (không chuẩn hóa, để lọt qua bộ lọc, sẽ phạt confidence
    if (historyValues.length < 3) {

      state.timeZ = state.unifiedRaw; 
    } else {
      const ema7 = historyValues.slice(1).reduce(
        (ema, value) => calcEMA(value, ema, 7),
        historyValues[0]
      );
      const mad7 = calcMAD(historyValues);
      const safeMad = Number.isFinite(mad7) ? Math.max(mad7 * 1.4826, 0.01) : 0.01;
      state.timeZ = (state.unifiedRaw - ema7) / safeMad;
    }

    if (symbol === 'BTC') btcTimeZ = state.timeZ;
  }

  // Beta Neutralization: Trừ đi tác động của thị trường chung (BTC)
  // Trung hòa tác động thị trường chung
  for (const [symbol, state] of tokenStates.entries()) {
    const historyCount = finiteHistoryValuesBySymbol.get(symbol)?.length ?? 0;
    
    // Nếu token mới (<3 điểm): pureAlphaZ = timeZ.
    if (historyCount < 3) {
      state.pureAlphaZ = state.timeZ; 
    } else {
      const dynamicBeta = options.dynamicBetaBySymbol?.[symbol];
      const betaToBtc = Number.isFinite(dynamicBeta)
        ? Math.min(Math.max(Number(dynamicBeta), 0), 2)//giới hạn beta 0->2
        : hyperParams.betaToBtc;

      state.pureAlphaZ = symbol === 'BTC'
        ? state.timeZ //Nếu là BTC: pureAlphaZ = timeZ.
        : state.timeZ! - (betaToBtc * btcTimeZ); // Token khác: pureAlphaZ = timeZ - (betaToBtc * btcTimeZ)
    }
  }

  // Cross-Sectional Z-Score & Final Filter
  // So sánh alpha của từng token với các token khác cùng thời điểm (loại trừ BTC và token mới).
  const validAlphas = Array.from(tokenStates.values())//tạo arr gồm pureAlphaZ của các token (trừ BTC và token mới)
    .filter(s => s.symbol !== 'BTC' && (finiteHistoryValuesBySymbol.get(s.symbol)?.length ?? 0) >= 3)
    .map(s => s.pureAlphaZ!)
    .filter(value => Number.isFinite(value));

  const len = validAlphas.length || 1;
  const crossMean = validAlphas.reduce((a, b) => a + b, 0) / len;
  const rawCrossStd = Math.sqrt(validAlphas.reduce((acc, val) => acc + Math.pow(val - crossMean, 2), 0) / len) || 1e-9;

  // KẸP ĐÁY PHƯƠNG SAI CHÉO (MICRO-VOLATILITY) tránh chia cho 0
  const safeCrossStd = Math.max(rawCrossStd, 0.05);

  const finalSignals: Partial<QuantSignalResponse>[] = [];

  for (const [symbol, state] of tokenStates.entries()) {
    const historyCount = finiteHistoryValuesBySymbol.get(symbol)?.length ?? 0;

    // BTC và Token < 3  không tham gia Cross-Sectional Z-Score
    if (historyCount < 3 || symbol === 'BTC') {
      state.crossZ = 0;
      state.finalScore = state.pureAlphaZ; 
    } else if (validAlphas.length >= 3) {
      state.crossZ = (state.pureAlphaZ! - crossMean) / safeCrossStd;
      state.finalScore = (hyperParams.alphaBlend * state.pureAlphaZ!) + ((1 - hyperParams.alphaBlend) * state.crossZ);
    } else {
      state.crossZ = 0;
      state.finalScore = state.pureAlphaZ;
    }

  
    //  Trích xuất các tín hiệu thực sự có giá trị giao dịch
    if (!Number.isFinite(state.finalScore)) continue;

    const rawFinalScore = state.finalScore!;
    const clampedFinalScore = clampScore(rawFinalScore, hyperParams.maxAbsSignalScore);
    state.finalScore = clampedFinalScore;

    const isNewToken = historyCount < 3; // Kiểm tra lính mới
    const regimeActionBuffer = options.marketRegime === "stress"
      ? 0.25 //khi thị trường căng thẳng, tăng ngưỡng hành động thêm 25% để tránh tín hiệu giả
      : options.marketRegime === "defensive"
        ? 0.1 //khi thị trường phòng thủ, tăng ngưỡng hành động thêm 10%
        : 0; //trạng thái khác không điều chỉnh ngưỡng hành động
    const actionThreshold = isNewToken
      ? hyperParams.coldStartActionThreshold
      : hyperParams.actionThreshold + regimeActionBuffer;
    const suggestionType = clampedFinalScore >= actionThreshold
      ? "buy"
      : (clampedFinalScore <= -actionThreshold ? "sell" : "hold");
    const requiredSignalThreshold = suggestionType === "hold"
      ? hyperParams.holdSignalThreshold
      : hyperParams.signalThreshold;

    if (Math.abs(clampedFinalScore) >= requiredSignalThreshold) {
      state.signalMode = isNewToken ? "COLD_START" : "NORMALIZED_ALPHA";
      const rawConfidence = Math.min(Math.abs(clampedFinalScore) / hyperParams.confidenceDivisor, 0.95);
      const sampleSizePenalty = historyCount <= 3 ? 0.75 : historyCount <= 5 ? 0.9 : 1;
      
      finalSignals.push({
        signalDetected: true,
        tokenSymbol: state.symbol,
        tokenAddress: state.tokenAddress, 
        sources: state.sources, 
        quantScore: clampedFinalScore,
        volatilityFlag: state.avgEntropy,
        uncertaintyEntropy: state.avgEntropy,
        sentimentType: clampedFinalScore > 0 ? "positive" : "negative",
        suggestionType,
        
        //  CƠ CHẾ PHẠT TỰ TIN: Lính mới tối đa 40%, token ít mẫu bị giảm thêm để tránh saturate 100%.
        confidence: isNewToken 
            ? Math.min(Math.abs(clampedFinalScore) / hyperParams.coldStartConfidenceDivisor, 0.4)
            : rawConfidence * sampleSizePenalty,
        signalMode: state.signalMode,
            
        //  LÝ DO MINH BẠCH DÀNH CHO DASHBOARD LAYER 3
        rationaleSummary: isNewToken 
            ? `[Cold Start] Tín hiệu dựa vào ${clampedFinalScore > 0 ? 'bullish' : 'bearish'} sentiment mạnh mẽ hôm nay, nhưng thiếu dữ liệu lịch sử đối chiếu.`
            : `Quant V3 detected a significant ${clampedFinalScore > 0 ? 'bullish' : 'bearish'} alpha divergence.`,
        metadata: {
          type: "quant_v3_aggregation",
          hyperParams,
          scoreComponents: {
            unifiedRaw: state.unifiedRaw,
            timeZ: state.timeZ,
            pureAlphaZ: state.pureAlphaZ,
            crossZ: state.crossZ,
            rawFinalScore,
            finalScore: clampedFinalScore,
            scoreWasClamped: rawFinalScore !== clampedFinalScore,
            maxAbsSignalScore: hyperParams.maxAbsSignalScore,
            btcTimeZ,
            crossMean,
            crossStd: safeCrossStd,
            dynamicBetaToBtc: options.dynamicBetaBySymbol?.[symbol] ?? hyperParams.betaToBtc,
          },
          marketRegime: options.marketRegime ?? "mixed",
          isNewToken,
          sampleSize: historyCount,
          signalMode: state.signalMode,
          thresholdDecision: {
            actionThreshold,
            signalThreshold: hyperParams.signalThreshold,
            holdSignalThreshold: hyperParams.holdSignalThreshold,
            requiredSignalThreshold,
            suggestionType,
          },
          uncertaintyEntropy: state.avgEntropy,
          sourceKeys: (state.allSources ?? state.sources).map(source => source.sourceKey).filter(Boolean),
          evidenceSources: state.allSources ?? state.sources,
        },
      });
    }
  }

  return finalSignals;
}
