import { finBertProbs } from "./finbert.js";
import { calcNormEntropy, calcDecay } from "./quant-math.js";
import { ScoredDoc } from "./types.js"; // Đã xóa import thừa tránh lỗi noUnusedLocals

function parseDateRobust(dateVal: any): number {
  if (!dateVal) return Date.now();
  if (typeof dateVal === 'object' && dateVal.$date) {
    return new Date(dateVal.$date).getTime();
  }
  return new Date(dateVal).getTime();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface CompiledToken {
  symbol: string;
  name: string;
  address?: string;
  symbolRegex: RegExp;
  nameRegex: RegExp;
}

// [FIX ISSUE 1]: Hàm quét Token động dành riêng cho Tweets (Trả về mảng nhiều Token)
function findTokensInText(text: string, compiledTokens: CompiledToken[]): CompiledToken[] {
  if (!text) return [];
  const found: CompiledToken[] = [];

  for (const token of compiledTokens) {
    if (token.symbolRegex.test(text) || token.nameRegex.test(text)) {
      found.push(token);
    }
  }
  return found;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

export async function processDocuments(
  allDocs: any[],
  knownTokens: any[]
): Promise<ScoredDoc[]> {

  const MAX_WEIGHT_PER_USER = 5.0;
  const userWeightUsage = new Map<string, number>();
  const scoredDocuments: ScoredDoc[] = [];

  // 🚀 [FINAL FIX - PERFORMANCE]: Khởi tạo Cache để tránh gọi API trùng lặp
  const textScoreCache = new Map<string, any>();

  const compiledTokens: CompiledToken[] = knownTokens.map(token => {
    const symStr = token.symbol.trim();
    const symUpper = escapeRegex(symStr.toUpperCase());
    const symLower = escapeRegex(symStr.toLowerCase());
    
    // Name: Chuẩn hóa để bắt chữ HOA ĐẦU (Chainlink) hoặc HOA TOÀN BỘ (CHAINLINK)
    const nameStr = token.name.trim();
    const nameCapitalized = escapeRegex(nameStr.charAt(0).toUpperCase() + nameStr.slice(1).toLowerCase());
    const nameUpper = escapeRegex(nameStr.toUpperCase());

    return {
      ...token,
      // 🚀 Regex Symbol (Bỏ cờ 'i'): Chấp nhận $LINK, $link, #LINK, #link, hoặc LINK (bắt buộc viết hoa)
      symbolRegex: new RegExp(`(?<![a-zA-Z0-9])(?:[\\$#]${symUpper}|[\\$#]${symLower}|${symUpper})(?![a-zA-Z0-9])`, 'g'),
      
      // 🚀 Regex Name (Bỏ cờ 'i'): Chấp nhận Chainlink hoặc CHAINLINK. Tránh false positive với "link" thường.
      nameRegex: new RegExp(`(?<![a-zA-Z0-9])(?:${nameCapitalized}|${nameUpper})(?![a-zA-Z0-9])`, 'g')
    };
  });

  // 🚨 VÁ LỖI TYPE SCRIPT: Định danh cứng cấu trúc mảng để TS không bối rối (Thủ phạm gây lỗi null prototype)
  const relevantDocs: Array<{ doc: any; token: CompiledToken }> = [];

  // [BỔ SUNG KIẾN TRÚC]: Tách biệt luồng nhận diện Token giữa Tweet và News
  for (const doc of allDocs) {
    const isTweet = doc.docType === 'tweet';
    let matchedTokens: CompiledToken[] = [];

    if (isTweet) {
      // Tweets: Quét văn bản trực tiếp bằng Regex
      const textToSearch = doc.text || "";
      matchedTokens = findTokensInText(textToSearch, compiledTokens);
    } else {
      // News: Tận dụng mảng detectedTokens đã được hệ thống Scraper trích xuất sẵn trong DB
      if (doc.detectedTokens && Array.isArray(doc.detectedTokens)) {
        const detectedUpper = doc.detectedTokens.map((t: string) => t.toUpperCase());
        // Map mảng string thành mảng CompiledToken object
        matchedTokens = compiledTokens.filter(t => detectedUpper.includes(t.symbol.toUpperCase()));
      }
    }

    // Nếu bài báo/tweet nhắc đến 3 Token, nhân bản thành 3 record độc lập
    for (const token of matchedTokens) {
      relevantDocs.push({ doc, token });
    }
  }

  const chunks = chunkArray(relevantDocs, 10);

  for (const chunk of chunks) {
    for (const { doc, token } of chunk) {
      try {
        const isTweet = doc.docType === 'tweet';
        const textToScore = isTweet ? doc.text : `${doc.title}\n${doc.summary}`;

        let probs;

        // 🚀 [FINAL FIX - PERFORMANCE]: Kiểm tra Cache trước khi gọi API HuggingFace
        if (textScoreCache.has(textToScore)) {
          probs = textScoreCache.get(textToScore);
        } else {
          probs = await finBertProbs(textToScore);
          textScoreCache.set(textToScore, probs); // Lưu kết quả vào Cache
        }

        const directionScore = probs.pPos - probs.pNeg;
        const entropy = calcNormEntropy(probs.pPos, probs.pNeg, probs.pNeu);

        const publishTime = isTweet ? parseDateRobust(doc.time) : parseDateRobust(doc.publishedAt);
        const hoursOld = (Date.now() - publishTime) / (1000 * 60 * 60);
        const decay = calcDecay(hoursOld, 12);

        let rawWeight = 1.0;
        if (isTweet) {
          const engagement = (doc.replyCount || 0) + (doc.retweetCount || 0) + (doc.likeCount || 0);
          rawWeight = 1 + Math.log(1 + engagement);
        } else {
          rawWeight = 2.0;
        }

        let finalWeight = rawWeight * decay;

        if (isTweet && doc.author) {
          const currentUsage = userWeightUsage.get(doc.author) || 0;
          const allowedWeight = Math.min(finalWeight, Math.max(0, MAX_WEIGHT_PER_USER - currentUsage));
          userWeightUsage.set(doc.author, currentUsage + allowedWeight);
          finalWeight = allowedWeight;
        }

        const finalUrl = isTweet ? doc.url : (doc.articleUrl || doc.siteUrl);

        if (finalWeight > 0.01) {
          scoredDocuments.push({
            tokenSymbol: token.symbol,
            tokenAddress: token.address || "unknown_address",
            directionScore,
            entropy,
            finalWeight,
            url: finalUrl || "No_URL",
            type: isTweet ? 'tweet' : 'news'
          });
        }
      } catch (err: any) {
        console.error(`[Quant V3] Lỗi xử lý tài liệu cho token ${token.symbol}:`, err?.message || err);
      }

      // 🚀 BỔ SUNG: Cho API nghỉ ngơi 300ms sau MỖI BÀI BÁO
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Sau khi chạy xong 1 lô (chunk 10 bài), nghỉ ngơi thêm 2 giây cho chắc ăn
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return scoredDocuments;
}