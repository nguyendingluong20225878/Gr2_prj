import { calcMAD, median } from "./quant-math.js";
import { TokenQuantState, QuantSignalResponse } from "./types.js";

export function evaluateAlphaAndCross(
  tokenStates: Map<string, TokenQuantState>, 
  historicalData: Record<string, any[]>
): Partial<QuantSignalResponse>[] {
  
  // ======================================================================
  // GIAI ĐOẠN 4: Z-Score & Beta (Time-Series Alpha)
  // ======================================================================
  let btcTimeZ = 0;
  for (const [symbol, state] of tokenStates.entries()) {
    const history = historicalData[symbol] || [];
    
    // Bảo vệ Token non trẻ (N < 3): Ngồi ngoài cuộc chơi Beta
    if (history.length < 3) {
      // 🚀 [GIẢI PHÁP COLD START TỐI ƯU]: 
      // Giữ nguyên điểm gốc để lọt qua bộ lọc > 0.5 và được lưu vào DB.
      // Hình phạt sẽ được áp dụng vào biến 'confidence' ở Giai đoạn 5.
      state.timeZ = state.unifiedRaw; 
    } else {
      const ema7 = history.length > 1 ? history[history.length - 2].unifiedRaw : state.unifiedRaw; 
      const mad7 = calcMAD(history.map(h => h.unifiedRaw));
      const safeMad = Math.max(mad7 * 1.4826, 0.01);
      state.timeZ = (state.unifiedRaw - ema7) / safeMad;
    }

    if (symbol === 'BTC') btcTimeZ = state.timeZ;
  }
  // =========================================================================
  // 🚀 [FINAL TOUCH - BUG 1]: TRẢM BỎ FALLBACK DỊ BỘ (NO NEWS IS FLAT NEWS)
  // Xóa bỏ toàn bộ khối lệnh bới móc dữ liệu quá khứ của BTC. 
  // Nếu lô cào hiện tại không có tin về BTC, btcTimeZ = 0. 
  // Đảm bảo không lấy "Bóng ma của hôm qua" áp đặt lên "Thế trận của hôm nay".
  // =========================================================================

  // Beta Neutralization: Trừ đi tác động của thị trường chung (BTC)
  for (const [symbol, state] of tokenStates.entries()) {
    const history = historicalData[symbol] || [];
    
    // Bảo vệ Token non trẻ (N < 3): Ngồi ngoài cuộc chơi Beta
    if (history.length < 3) {
      state.pureAlphaZ = state.timeZ; 
    } else {
      state.pureAlphaZ = symbol === 'BTC' ? state.timeZ : state.timeZ! - (0.75 * btcTimeZ);
    }
  }

  // GIAI ĐOẠN 5: Cross-Sectional Z-Score & Final Filter
  
  // [BẢN VÁ BUG 2]: Cách ly Benchmark BTC và Token non trẻ khỏi mảng so sánh chéo
  const validAlphas = Array.from(tokenStates.values())
    .filter(s => s.symbol !== 'BTC' && (historicalData[s.symbol]?.length || 0) >= 3)
    .map(s => s.pureAlphaZ!);

  const len = validAlphas.length || 1;
  const crossMean = validAlphas.reduce((a, b) => a + b, 0) / len;
  const rawCrossStd = Math.sqrt(validAlphas.reduce((acc, val) => acc + Math.pow(val - crossMean, 2), 0) / len) || 1e-9;

  // KẸP ĐÁY PHƯƠNG SAI CHÉO (MICRO-VOLATILITY)
  const safeCrossStd = Math.max(rawCrossStd, 0.05);

  const finalSignals: Partial<QuantSignalResponse>[] = [];

  for (const [symbol, state] of tokenStates.entries()) {
    const history = historicalData[symbol] || [];

    // BTC và Token < 3 ngày tuổi không tham gia Cross-Sectional Z-Score
    if (history.length < 3 || symbol === 'BTC') {
      state.crossZ = 0;
      state.finalScore = state.pureAlphaZ; 
    } else if (validAlphas.length >= 3) {
      state.crossZ = (state.pureAlphaZ! - crossMean) / safeCrossStd;
      state.finalScore = (0.7 * state.pureAlphaZ!) + (0.3 * state.crossZ);
    } else {
      state.crossZ = 0;
      state.finalScore = state.pureAlphaZ;
    }

    // ======================================================================
    // [BỘ LỌC CUỐI CÙNG]: Trích xuất các tín hiệu thực sự có giá trị giao dịch
    // ======================================================================
    if (Math.abs(state.finalScore!) > 0.5) {
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
        suggestionType: state.finalScore! > 1.5 ? "buy" : (state.finalScore! < -1.5 ? "sell" : "hold"),
        
        // 🚀 CƠ CHẾ PHẠT TỰ TIN: Lính mới tối đa 40%, Lính cũ tối đa 100%
        confidence: isNewToken 
            ? Math.min(Math.abs(state.finalScore!) / 5, 0.4) 
            : Math.min(Math.abs(state.finalScore!) / 3, 1),
            
        // 🚀 LÝ DO MINH BẠCH DÀNH CHO DASHBOARD LAYER 3
        rationaleSummary: isNewToken 
            ? `[Cold Start] Tín hiệu dựa vào ${state.finalScore! > 0 ? 'bullish' : 'bearish'} sentiment mạnh mẽ hôm nay, nhưng thiếu dữ liệu lịch sử đối chiếu.` 
            : `Quant V3 detected a significant ${state.finalScore! > 0 ? 'bullish' : 'bearish'} alpha divergence.`,
      });
    }
  }

  return finalSignals;
}