import { DetectorParams } from "./types.js";
import { processDocuments } from "./document-processor.js";
import { aggregateAndNormalize } from "./token-aggregator.js";
import { evaluateAlphaAndCross } from "./alpha-analyzer.js";

/**
 * NHẠC TRƯỞNG QUANT ENGINE V3 (Modular)
 */
export async function detectSignalWithFinBertQuant(params: DetectorParams) {
  const { formattedTweets, formattedNews, knownTokens, historicalData = {} } = params;
  
  const allDocs = [
    ...formattedTweets.map(t => ({ ...t, docType: 'tweet' })),
    ...formattedNews.map(n => ({ ...n, docType: 'news' }))
  ];

  console.log(`[Quant V3] Bước 1: Phân tích Document & Trọng số (${allDocs.length} items)...`);
  const scoredDocs = await processDocuments(allDocs, knownTokens);

  console.log(`[Quant V3] Bước 2: Gom Token & Chuẩn hóa Khối lượng...`);
  const tokenStates = aggregateAndNormalize(scoredDocs);

  console.log(`[Quant V3] Bước 3: Đánh giá Alpha Lịch sử & Đối chiếu Chéo...`);
  const finalSignals = evaluateAlphaAndCross(tokenStates, historicalData);

  console.log(`[Quant V3] Hoàn tất! Lọc được ${finalSignals.length} tín hiệu Alpha thuần.`);
  return finalSignals;
}