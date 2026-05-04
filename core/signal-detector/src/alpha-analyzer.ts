import { calcMAD } from "./quant-math.js";
import { TokenQuantState, QuantSignalResponse } from "./types.js";

export function evaluateAlphaAndCross(
  tokenStates: Map<string, TokenQuantState>, 
  historicalData: Record<string, any[]>
): Partial<QuantSignalResponse>[] {
  
  let btcTimeZ = 0;

  // GIAI ĐOẠN 4: Z-Score & Beta
  for (const [symbol, state] of tokenStates.entries()) {
    const history = historicalData[symbol] || [];
    const ema7 = history.length > 0 ? history[history.length - 1].unifiedRaw : 0; 
    const mad7 = calcMAD(history.map(h => h.unifiedRaw));

    state.timeZ = (state.unifiedRaw - ema7) / ((mad7 * 1.4826) || 1e-9);

    if (symbol === 'BTC') btcTimeZ = state.timeZ;
  }

  for (const [symbol, state] of tokenStates.entries()) {
    state.pureAlphaZ = symbol === 'BTC' ? state.timeZ : state.timeZ! - (0.75 * btcTimeZ);
  }

  // GIAI ĐOẠN 5: Cross-Sectional Z-Score & Final Filter
  const allAlphas = Array.from(tokenStates.values()).map(s => s.pureAlphaZ!);
  const crossMean = allAlphas.reduce((a, b) => a + b, 0) / (allAlphas.length || 1);
  const crossStd = Math.sqrt(allAlphas.reduce((acc, val) => acc + Math.pow(val - crossMean, 2), 0) / (allAlphas.length || 1)) || 1e-9;

  const finalSignals: Partial<QuantSignalResponse>[] = [];

  for (const [symbol, state] of tokenStates.entries()) {
    if (tokenStates.size >= 3) {
      state.crossZ = (state.pureAlphaZ! - crossMean) / crossStd;
      state.finalScore = (0.7 * state.pureAlphaZ!) + (0.3 * state.crossZ);
    } else {
      state.crossZ = 0;
      state.finalScore = state.pureAlphaZ;
    }

    if (Math.abs(state.finalScore!) > 0.5) {
      finalSignals.push({
        signalDetected: true,
        tokenSymbol: state.symbol,
        quantScore: state.finalScore,
        volatilityFlag: state.volatilityFlag,
        sentimentType: state.finalScore! > 0 ? "positive" : "negative",
        suggestionType: "hold",
        confidence: Math.min(Math.abs(state.finalScore!) / 3, 1),
        rationaleSummary: `Hệ thống Định lượng V3 ghi nhận tín hiệu Alpha (Score: ${state.finalScore?.toFixed(2)}). Chờ LLM phân tích ngữ nghĩa.`,
        sources: state.sources.map(url => ({ url, label: 'Quant Source' }))
      });
    }
  }

  return finalSignals;
}