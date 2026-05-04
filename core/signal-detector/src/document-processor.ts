import { finBertProbs } from "./finbert.js";
import { calcNormEntropy, calcDecay } from "./quant-math.js";
import { ScoredDoc, FormattedTweet, FormattedNews } from "./types.js";

// Hàm parse thời gian an toàn (Hỗ trợ cả chuẩn ISO và Mongoose {$date})
function parseDateRobust(dateVal: any): number {
  if (!dateVal) return Date.now();
  if (typeof dateVal === 'object' && dateVal.$date) {
    return new Date(dateVal.$date).getTime();
  }
  return new Date(dateVal).getTime();
}

function findToken(text: string, knownTokens: any[]): any | null {
  if (!text) return null;
  const upperText = text.toUpperCase();
  for (const token of knownTokens) {
    if (upperText.includes(token.symbol.toUpperCase()) || upperText.includes(token.name.toUpperCase())) {
      return token;
    }
  }
  return null;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

export async function processDocuments(
  allDocs: any[], // Mảng đã trộn chung Tweets và News
  knownTokens: any[]
): Promise<ScoredDoc[]> {
  const scoredDocuments: ScoredDoc[] = [];
  const userWeightUsage = new Map<string, number>();
  const MAX_WEIGHT_PER_USER = 5.0;

  // 1. Chuẩn hóa Input: Gom chữ từ Tweet và News
  const relevantDocs = allDocs.map(doc => {
    const isTweet = doc.docType === 'tweet';
    // Gộp title và content đối với News để AI đọc hiểu ngữ cảnh tốt hơn
    const text = isTweet ? doc.text : `${doc.title || ''}. ${doc.summary || ''}. ${doc.content || ''}`;
    const token = findToken(text, knownTokens);
    return { doc, text, token, isTweet };
  }).filter(item => item.token !== null);

  // 2. Chia nhỏ gọi API FinBERT (Mỗi lượt 10 bài để chống lỗi Timeout)
  const chunks = chunkArray(relevantDocs, 10);
  
  for (const chunk of chunks) {
    const promises = chunk.map(async ({ doc, text, token, isTweet }) => {
      try {
        // [GĐ 1] Gọi AI chấm điểm Cảm xúc & Biến động
        const { pPos, pNeg, pNeu } = await finBertProbs(text);
        const directionScore = pPos - pNeg;
        const entropy = calcNormEntropy(pPos, pNeg, pNeu);

        // [GĐ 2.1] Tính toán Decay Thời gian
        // Lấy đúng field thời gian của V2
        const dateRaw = isTweet ? (doc.time || doc.tweetTime) : (doc.publishedAt || doc.createdAt);
        const docDateMs = parseDateRobust(dateRaw);
        const hoursOld = (Date.now() - docDateMs) / (1000 * 60 * 60);
        const decay = calcDecay(hoursOld, 12); // Nửa đời phân rã 12 tiếng

        // [GĐ 2.2] Tính Sức nặng (Trọng số)
        let rawWeight = 1.0;
        if (isTweet) {
          const engagement = (doc.replyCount || 0) + (doc.retweetCount || 0) + (doc.likeCount || 0);
          rawWeight = 1 + Math.log(1 + engagement); // Cộng điểm cho tweet viral
        } else {
          rawWeight = 2.0; // News uy tín hơn tweet lẻ, mặc định x2 sức nặng
        }

        let finalWeight = rawWeight * decay;

        // [GĐ 2.3] Chặn Bot Spam (Chỉ chặn trên Twitter)
        if (isTweet && doc.author) { // V2 Tweet dùng trường `author`
          const currentUsage = userWeightUsage.get(doc.author) || 0;
          const allowedWeight = Math.min(finalWeight, Math.max(0, MAX_WEIGHT_PER_USER - currentUsage));
          userWeightUsage.set(doc.author, currentUsage + allowedWeight);
          finalWeight = allowedWeight;
        }

        // Lấy URL chuẩn
        const finalUrl = isTweet ? doc.url : (doc.articleUrl || doc.siteUrl);

        if (finalWeight > 0.01) { // Lọc bỏ các bài quá cũ (weight < 0.01)
          scoredDocuments.push({
            tokenSymbol: token.symbol,
            directionScore,
            entropy,
            finalWeight,
            url: finalUrl || "No_URL",
            type: doc.docType
          });
        }
      } catch (err) {
        console.error(`[Document Processor] Bỏ qua 1 tài liệu do lỗi FinBERT:`, err instanceof Error ? err.message : err);
      }
    });

    await Promise.all(promises);
  }

  return scoredDocuments;
}