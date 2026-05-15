import { median } from "./quant-math.js";
import { ScoredDoc, TokenQuantState, Source } from "./types.js";

export function aggregateAndNormalize(scoredDocuments: ScoredDoc[]): Map<string, TokenQuantState> {
  const tokenGroups = new Map<string, ScoredDoc[]>();
  const addressMap = new Map<string, string>();

  scoredDocuments.forEach(doc => {
    if (!tokenGroups.has(doc.tokenSymbol)) {
      tokenGroups.set(doc.tokenSymbol, []);
      addressMap.set(doc.tokenSymbol, doc.tokenAddress);
    }
    tokenGroups.get(doc.tokenSymbol)!.push(doc);
  });

  const allWeights = Array.from(tokenGroups.values()).map(docs => docs.reduce((sum, d) => sum + d.finalWeight, 0));
  const medianMarketWeight = median(allWeights) || 0;
  
  const marketNormFactor = Math.max(Math.log(1 + medianMarketWeight), 0.1);

  const tokenStates = new Map<string, TokenQuantState>();

  for (const [symbol, docs] of tokenGroups.entries()) {
    const totalWeight = docs.reduce((sum, d) => sum + d.finalWeight, 0);
    const weightedBase = docs.reduce((sum, d) => sum + (d.directionScore * d.finalWeight), 0) / (totalWeight || 1e-9);
    const avgEntropy = docs.reduce((sum, d) => sum + d.entropy, 0) / docs.length;

    const volumeBoost = Math.log(1 + totalWeight) / marketNormFactor;
    const unifiedRaw = weightedBase * (1 + volumeBoost);

    // =========================================================================
    // 🚀 [FINAL FIX BUG 1]: SẮP XẾP BẰNG CHỨNG THEO ĐỘ UY TÍN (WEIGHT)
    // Sắp xếp mảng giảm dần theo finalWeight trước khi cắt (slice). 
    // Giúp LLM ở Layer 3 luôn đọc được những bài báo/tweet có sức nặng nhất.
    // =========================================================================
    const sources: Source[] = [...docs]
      .sort((a, b) => b.finalWeight - a.finalWeight)
      .slice(0, 5) 
      .map(d => ({
        url: d.url,
        label: d.type === 'tweet' ? 'X (Twitter)' : 'News Article'
      }));

    tokenStates.set(symbol, {
      symbol,
      tokenAddress: addressMap.get(symbol) || "unknown_address",
      docsCount: docs.length,
      unifiedRaw,
      avgEntropy,
      sources, // Đã lưu vết thành công với dữ liệu xịn nhất
      timeZ: 0,
      pureAlphaZ: 0
    });
  }

  return tokenStates;
}