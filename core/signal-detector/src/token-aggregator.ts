import { median } from "./quant-math.js";
import { ScoredDoc, TokenQuantState } from "./types.js";

export function aggregateAndNormalize(scoredDocuments: ScoredDoc[]): Map<string, TokenQuantState> {
  const tokenGroups = new Map<string, ScoredDoc[]>();
  
  scoredDocuments.forEach(doc => {
    if (!tokenGroups.has(doc.tokenSymbol)) tokenGroups.set(doc.tokenSymbol, []);
    tokenGroups.get(doc.tokenSymbol)!.push(doc);
  });

  // Tìm Median Market Attention
  const allWeights = Array.from(tokenGroups.values()).map(docs => docs.reduce((sum, d) => sum + d.finalWeight, 0));
  const medianMarketWeight = median(allWeights) || 1e-9;
  const marketNormFactor = Math.log(1 + medianMarketWeight);

  const tokenStates = new Map<string, TokenQuantState>();

  for (const [symbol, docs] of tokenGroups.entries()) {
    const totalWeight = docs.reduce((sum, d) => sum + d.finalWeight, 0);
    const weightedBase = docs.reduce((sum, d) => sum + (d.directionScore * d.finalWeight), 0) / (totalWeight || 1e-9);
    const avgEntropy = docs.reduce((sum, d) => sum + d.entropy, 0) / docs.length;

    // Chuẩn hóa volume V3
    const volumeBoost = Math.log(1 + totalWeight) / marketNormFactor;
    const unifiedRaw = weightedBase * volumeBoost;

    tokenStates.set(symbol, {
      symbol,
      unifiedRaw,
      volatilityFlag: avgEntropy,
      sources: [...new Set(docs.map(d => d.url))].slice(0, 5)
    });
  }

  return tokenStates;
}