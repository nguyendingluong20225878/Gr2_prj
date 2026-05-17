import { median } from "./quant-math.js";
import { ScoredDoc, TokenQuantState, Source } from "./types.js";

//Nhóm tài liệu chấm theo token
export function aggregateAndNormalize(scoredDocuments: ScoredDoc[]): Map<string, TokenQuantState> {
  const tokenGroups = new Map<string, ScoredDoc[]>();//Map các souces cungd 1 tokenSymbol
  const addressMap = new Map<string, string>();//Map add ~ symbol

  scoredDocuments.forEach(doc => {
    if (!tokenGroups.has(doc.tokenSymbol)) {
      tokenGroups.set(doc.tokenSymbol, []);
      addressMap.set(doc.tokenSymbol, doc.tokenAddress);
    }
    tokenGroups.get(doc.tokenSymbol)!.push(doc);
  });

  const allWeights = Array.from(tokenGroups.values()).map(docs => docs.reduce((sum, d) => sum + d.finalWeight, 0));//Tổng trọng số của mỗi token để tính median thị trường
  const medianMarketWeight = median(allWeights) || 0;//Median thị trường để chuẩn hóa trọng số
  
  const marketNormFactor = Math.max(Math.log(1 + medianMarketWeight), 0.1);//Hệ số chuẩn hóa thị trường, tránh chia cho 0 và làm phẳng quá mức khi median quá thấp

  const tokenStates = new Map<string, TokenQuantState>();

  for (const [symbol, docs] of tokenGroups.entries()) {
    const totalWeight = docs.reduce((sum, d) => sum + d.finalWeight, 0);
    const weightedBase = docs.reduce((sum, d) => sum + (d.directionScore * d.finalWeight), 0) / (totalWeight || 1e-9);
    const avgEntropy = docs.reduce((sum, d) => sum + d.entropy, 0) / docs.length;

    const volumeBoost = Math.log(1 + totalWeight) / marketNormFactor;
    const unifiedRaw = weightedBase * (1 + volumeBoost);

    // =========================================================================
    // Sắp xếp mảng giảm dần theo finalWeight trước khi cắt (slice). 
    // Giúp LLM ở Layer 3 luôn đọc được những bài báo/tweet có sức nặng nhất.
    // =========================================================================
    const sources: Source[] = [...docs]
      .sort((a, b) => b.finalWeight - a.finalWeight)
      .slice(0, 5) 
      .map(d => ({
        url: d.url,
        label: d.type === 'tweet' ? 'X (Twitter)' : 'News Article',
        sourceKey: d.sourceKey,
        weight: d.finalWeight,
      }));

    tokenStates.set(symbol, {
      symbol,
      tokenAddress: addressMap.get(symbol) || "unknown_address",
      docsCount: docs.length,//Số lượng tài liệu liên quan đến token, có thể dùng để đánh giá độ tin cậy
      unifiedRaw,//Điểm tổng hợp chưa chuẩn hóa, sẽ được sử dụng để tính z-score và beta ở các giai đoạn sau
      avgEntropy,
      sources, // Lưu trữ nguồn gốc của tín hiệu để Layer 3 có thể truy xuất khi cần thiết
      timeZ: 0,//Điểm z-score theo thời gian
      pureAlphaZ: 0//Điểm alpha đã được loại bỏ tác động thị trường
    });
  }

  return tokenStates;
}


// Hàm này giúp tổng hợp các tín hiệu rời rạc (tweet/news) thành một trạng thái duy nhất cho mỗi token, có chuẩn hóa theo quy mô thị trường.
// Chỉ giữ lại các nguồn bằng chứng mạnh nhất, giúp các tầng sau (ví dụ LLM) dễ dàng truy xuất và giải thích tín hiệu.
// Các chỉ số như unifiedRaw, avgEntropy, docsCount, sources... là đầu vào quan trọng cho các bước phân tích, ra quyết định hoặc lưu xuống DB.