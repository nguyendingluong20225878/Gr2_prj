import { calcMAD, median } from "./quant-math.js";
import { DetectorHyperParams, TokenQuantState, QuantSignalResponse } from "./types.js";

//Phân tích tín hiệu alpha và chuẩn hóa chéo cho từng token
export function evaluateAlphaAndCross(
  tokenStates: Map<string, TokenQuantState>,//quant của token  
  historicalData: Record<string, any[]>,//Dữ liệu lịch sử của token
  hyperParams: DetectorHyperParams//tham số điều chỉnh
): Partial<QuantSignalResponse>[] {//out: mảng tín hiệu quant cuối cùng chỉ gồm token có tín hiệu mạnh
  

  // Z-Score & Beta (Time-Series Alpha)
  // Đo xem unifiedRaw hiện tại của token lệch
  // bao nhiêu so với lịch sử gần nhất của chính nó
  let btcTimeZ = 0;
  for (const [symbol, state] of tokenStates.entries()) {
    const history = historicalData[symbol] || [];
    
    // Nếu token có ít hơn 3 điểm lịch sử (token mới)
    // thì timeZ = unifiedRaw (không chuẩn hóa, để lọt qua bộ lọc, sẽ phạt confidence
    if (history.length < 3) {

      state.timeZ = state.unifiedRaw; 
    } else {
      const ema7 = history.length > 1 ? history[history.length - 2].unifiedRaw : state.unifiedRaw; 
      const mad7 = calcMAD(history.map(h => h.unifiedRaw));
      const safeMad = Math.max(mad7 * 1.4826, 0.01);
      state.timeZ = (state.unifiedRaw - ema7) / safeMad;
    }

    if (symbol === 'BTC') btcTimeZ = state.timeZ;
  }

  // Beta Neutralization: Trừ đi tác động của thị trường chung (BTC)
  // Trung hòa tác động thị trường chung
  for (const [symbol, state] of tokenStates.entries()) {
    const history = historicalData[symbol] || [];
    
    // Nếu token mới (<3 điểm): pureAlphaZ = timeZ.
    if (history.length < 3) {
      state.pureAlphaZ = state.timeZ; 
    } else {
      state.pureAlphaZ = symbol === 'BTC'
        ? state.timeZ //Nếu là BTC: pureAlphaZ = timeZ.
        : state.timeZ! - (hyperParams.betaToBtc * btcTimeZ); // Token khác: pureAlphaZ = timeZ - (betaToBtc * btcTimeZ)
    }
  }

  // Cross-Sectional Z-Score & Final Filter
  // So sánh alpha của từng token với các token khác cùng thời điểm (loại trừ BTC và token mới).
  const validAlphas = Array.from(tokenStates.values())//tạo arr gồm pureAlphaZ của các token (trừ BTC và token mới)
    .filter(s => s.symbol !== 'BTC' && (historicalData[s.symbol]?.length || 0) >= 3)
    .map(s => s.pureAlphaZ!);

  const len = validAlphas.length || 1;
  const crossMean = validAlphas.reduce((a, b) => a + b, 0) / len;
  const rawCrossStd = Math.sqrt(validAlphas.reduce((acc, val) => acc + Math.pow(val - crossMean, 2), 0) / len) || 1e-9;

  // KẸP ĐÁY PHƯƠNG SAI CHÉO (MICRO-VOLATILITY) tránh chia cho 0
  const safeCrossStd = Math.max(rawCrossStd, 0.05);

  const finalSignals: Partial<QuantSignalResponse>[] = [];

  for (const [symbol, state] of tokenStates.entries()) {
    const history = historicalData[symbol] || [];

    // BTC và Token < 3  không tham gia Cross-Sectional Z-Score
    if (history.length < 3 || symbol === 'BTC') {
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
    if (Math.abs(state.finalScore!) > hyperParams.signalThreshold) {
      const history = historicalData[symbol] || [];
      const isNewToken = history.length < 3; // Kiểm tra lính mới
      
      finalSignals.push({
        signalDetected: true,
        tokenSymbol: state.symbol,
        tokenAddress: state.tokenAddress, 
        sources: state.sources, 
        quantScore: state.finalScore,
        volatilityFlag: state.avgEntropy,
        sentimentType: state.finalScore! > 0 ? "positive" : "negative",
        suggestionType: state.finalScore! > hyperParams.actionThreshold ? "buy" : (state.finalScore! < -hyperParams.actionThreshold ? "sell" : "hold"),
        
        //  CƠ CHẾ PHẠT TỰ TIN: Lính mới tối đa 40%, Lính cũ tối đa 100%
        confidence: isNewToken 
            ? Math.min(Math.abs(state.finalScore!) / hyperParams.coldStartConfidenceDivisor, 0.4) 
            : Math.min(Math.abs(state.finalScore!) / hyperParams.confidenceDivisor, 1),
            
        //  LÝ DO MINH BẠCH DÀNH CHO DASHBOARD LAYER 3
        rationaleSummary: isNewToken 
            ? `[Cold Start] Tín hiệu dựa vào ${state.finalScore! > 0 ? 'bullish' : 'bearish'} sentiment mạnh mẽ hôm nay, nhưng thiếu dữ liệu lịch sử đối chiếu.` 
            : `Quant V3 detected a significant ${state.finalScore! > 0 ? 'bullish' : 'bearish'} alpha divergence.`,
        metadata: {
          type: "quant_v3_aggregation",
          hyperParams,
          scoreComponents: {
            unifiedRaw: state.unifiedRaw,
            timeZ: state.timeZ,
            pureAlphaZ: state.pureAlphaZ,
            crossZ: state.crossZ,
            finalScore: state.finalScore,
            btcTimeZ,
            crossMean,
            crossStd: safeCrossStd,
          },
          sourceKeys: state.sources.map(source => source.sourceKey).filter(Boolean),
        },
      });
    }
  }

  return finalSignals;
}
