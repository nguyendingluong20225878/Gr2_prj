import { finBertProbs } from "./finbert.js";
import {
  connectToDatabase,
  sourceWeightsTable,
} from "@gr2/shared";
import { calcNormEntropy, calcDecay } from "./quant-math.js";
import {
  readSentimentCache,
  writeSentimentCache,
} from "./services/sentiment-cache-service.js";
import { DetectorHyperParams, ScoredDoc } from "./types.js"; 

export type ProcessDocumentOptions = {
  asOf: Date;
  throttleMs: number;
  chunkDelayMs: number;
};

function parseDateRobust(dateVal: unknown, fallbackMs: number): number {
  if (!dateVal) return fallbackMs;

  const raw =
    typeof dateVal === "object" && dateVal !== null && "$date" in dateVal
      ? (dateVal as { $date: unknown }).$date
      : dateVal;

  const ms = new Date(raw as any).getTime();
  return Number.isFinite(ms) ? ms : fallbackMs;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceKeyFromUrl(url: string | undefined): string {
  //Lấy hostname url làm sourceKey
  if (!url) return "unknown_source";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function loadSourceWeights(): Promise<Map<string, number>> {
  try {
    await connectToDatabase();
    const rows = await sourceWeightsTable
      .find({}, { siteHost: 1, sourceType: 1, sourceKey: 1, siteWeight: 1 })
      .lean();

    const weights = new Map<string, number>();
    for (const row of rows as any[]) {
      const weight = Number(row.siteWeight);
      if (!Number.isFinite(weight) || weight <= 0) continue;

      const siteHost = String(row.siteHost ?? "");
      if (siteHost) weights.set(siteHost, weight);

      const sourceType = String(row.sourceType ?? "");
      const sourceKey = String(row.sourceKey ?? "");
      if (sourceType && sourceKey) weights.set(`${sourceType}:${sourceKey}`, weight);
    }

    return weights;
  } catch (error) {
    console.warn(
      "[Quant V3] Không thể tải source_weights, fallback siteWeight=1:",
      error instanceof Error ? error.message : String(error)
    );
    return new Map();
  }
}

interface CompiledToken {
  symbol: string;
  name: string;
  address?: string;
  symbolRegex: RegExp;
  nameRegex: RegExp;
}

// Hàm quét Token động dành riêng cho Tweets (Trả về mảng nhiều Token)
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
// Hàm chia mảng thành các phần nhỏ hơn (chunk) để xử lý theo lô, giúp giảm tải cho API và tránh lỗi timeouts
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}
//tạo độ trễ, tránh bị rate limit khi gọi API
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function processDocuments(
  allDocs: any[],
  knownTokens: any[],
  hyperParams: DetectorHyperParams,
  options: ProcessDocumentOptions
): Promise<ScoredDoc[]> {

  const userWeightUsage = new Map<string, number>();
  const scoredDocuments: ScoredDoc[] = [];
  const startedAt = Date.now();
  const metrics = {
    docs: allDocs.length,
    relevantDocTokenPairs: 0,
    memoryCacheHits: 0,
    persistentCacheHits: 0,
    finbertCalls: 0,
  };
  const sourceWeights = await loadSourceWeights();

  // Khởi tạo Cache để tránh gọi API trùng lặp
  const textScoreCache = new Map<string, any>();

  const compiledTokens: CompiledToken[] = knownTokens
    .map(token => ({
      ...token,
      symbol: String(token.symbol ?? "").trim(),
      name: String(token.name ?? "").trim(),
    }))
    .filter(token => token.symbol.length >= 2 && token.name.length >= 2)
    .map(token => {
      const symUpper = escapeRegex(token.symbol.toUpperCase());
      const symLower = escapeRegex(token.symbol.toLowerCase());
      const nameCapitalized = escapeRegex(
        token.name.charAt(0).toUpperCase() + token.name.slice(1).toLowerCase()
      );
      const nameUpper = escapeRegex(token.name.toUpperCase());

      return {
        ...token,
        // Regex Symbol (Bỏ cờ 'i'): Chấp nhận $LINK, $link, #LINK, #link, hoặc LINK (bắt buộc viết hoa)
        symbolRegex: new RegExp(`(?<![a-zA-Z0-9])(?:[\\$#]${symUpper}|[\\$#]${symLower}|${symUpper})(?![a-zA-Z0-9])`),
        
        //  Regex Name (Bỏ cờ 'i'): Chấp nhận Chainlink hoặc CHAINLINK. Tránh false positive với "link" thường.
        nameRegex: new RegExp(`(?<![a-zA-Z0-9])(?:${nameCapitalized}|${nameUpper})(?![a-zA-Z0-9])`)
      };
    });

  //  Định danh cứng cấu trúc mảng để tận dụng dữ liệu đã được Scraper trích xuất sẵn cho News
  const relevantDocs: Array<{ doc: any; token: CompiledToken }> = [];

  // Tách biệt luồng nhận diện Token giữa Tweet và News
  for (const doc of allDocs) {
    const isTweet = doc.docType === 'tweet';
    let matchedTokens: CompiledToken[] = [];

    if (isTweet) {
      // Tweets: Quét văn bản trực tiếp bằng Regex
      const textToSearch = doc.text || "";
      matchedTokens = findTokensInText(textToSearch, compiledTokens);
    } else {
      // News: Dùng mảng detectedTokens đã được hệ thống Scraper trích xuất sẵn trong DB
      if (doc.detectedTokens && Array.isArray(doc.detectedTokens)) {
        const detectedUpper = doc.detectedTokens.map((t: string) => t.toUpperCase());
        // Map mảng string thành mảng CompiledToken object
        matchedTokens = compiledTokens.filter(t => detectedUpper.includes(t.symbol.toUpperCase()));
      }
    }

    // Nếu bài báo/tweet nhắc đến nhiều token thì sẽ tạo ra nhiều bản ghi tung
    for (const token of matchedTokens) {
      relevantDocs.push({ doc, token });
    }
  }
  metrics.relevantDocTokenPairs = relevantDocs.length;

  const chunks = chunkArray(relevantDocs, 10);
  const asOfMs = options.asOf.getTime();
  if (!Number.isFinite(asOfMs)) {
    throw new Error("processDocuments requires a valid asOf date");
  }

  for (const chunk of chunks) {
    for (const { doc, token } of chunk) {
      try {
        const isTweet = doc.docType === 'tweet';
        const textToScore = isTweet
          ? String(doc.text || "").trim()
          : [doc.title, doc.summary, doc.content].filter(Boolean).join("\n").trim();

        if (!textToScore) continue;

        let probs;

        //  Kiểm tra cache trước khi gọi API HuggingFace.
        if (textScoreCache.has(textToScore)) {
          probs = textScoreCache.get(textToScore);
          metrics.memoryCacheHits += 1;
        } else {
          probs = await readSentimentCache(textToScore);
          if (probs) {
            metrics.persistentCacheHits += 1;
          } else {
            metrics.finbertCalls += 1;
            probs = await finBertProbs(textToScore);
            await writeSentimentCache(textToScore, probs);
          }
          textScoreCache.set(textToScore, probs);
        }

        const directionScore = probs.pPos - probs.pNeg;
        const entropy = calcNormEntropy(probs.pPos, probs.pNeg, probs.pNeu);

        const publishTime = isTweet
          ? parseDateRobust(doc.time, asOfMs)
          : parseDateRobust(doc.publishedAt, asOfMs);
        const hoursOld = Math.max(0, (asOfMs - publishTime) / (1000 * 60 * 60));
        const halfLife = isTweet
          ? hyperParams.tweetHalfLifeHours
          : hyperParams.newsHalfLifeHours;
        const decay = calcDecay(hoursOld, halfLife);

        let rawWeight = 1.0;
        if (isTweet) {
          const engagement = (doc.replyCount || 0) + (doc.retweetCount || 0) + (doc.likeCount || 0);
          const authorWeight = Number.isFinite(doc.authorWeight) && doc.authorWeight > 0
            ? Number(doc.authorWeight)
            : 1;
          const authorKey = String(doc.author || "unknown_author");
          const dynamicAuthorWeight = sourceWeights.get(`twitter:${authorKey}`) ?? 1;
          rawWeight = authorWeight * dynamicAuthorWeight * (1 + Math.log(1 + engagement));
        } else {
          const sourceKey = sourceKeyFromUrl(doc.siteUrl || doc.articleUrl);
          const siteWeight = sourceWeights.get(`news:${sourceKey}`) ?? sourceWeights.get(sourceKey) ?? 1;
          rawWeight = hyperParams.newsBaseWeight * siteWeight;
        }

        let finalWeight = rawWeight * decay;

        if (isTweet && doc.author) {
          const currentUsage = userWeightUsage.get(doc.author) || 0;
          const allowedWeight = Math.min(finalWeight, Math.max(0, hyperParams.maxWeightPerUser - currentUsage));
          userWeightUsage.set(doc.author, currentUsage + allowedWeight);
          finalWeight = allowedWeight;
        }

        const finalUrl = isTweet ? doc.url : (doc.articleUrl || doc.siteUrl);
        const sourceKey = isTweet
          ? String(doc.author || "unknown_author")
          : sourceKeyFromUrl(doc.siteUrl || doc.articleUrl);

        if (finalWeight > 0.01) {
          scoredDocuments.push({
            tokenSymbol: token.symbol,
            tokenAddress: token.address || "unknown_address",
            directionScore,
            entropy,
            finalWeight,
            url: finalUrl || "No_URL",
            type: isTweet ? 'tweet' : 'news',
            sourceKey,
            author: isTweet ? doc.author : undefined,
            publishedAt: new Date(publishTime),
          });
        }
      } catch (err: any) {
        console.error(`[Quant V3] Lỗi xử lý tài liệu cho token ${token.symbol}:`, err?.message || err);
      }

      //  Cho API nghỉ ngơi 300ms sau MỖI BÀI BÁO
      if (options.throttleMs > 0) await sleep(options.throttleMs);
    }

    // Sau khi chạy xong 1 lô (chunk 10 bài), nghỉ ngơi thêm 2 giây cho chắc ăn
    if (options.chunkDelayMs > 0) await sleep(options.chunkDelayMs);
  }

  console.log(
    `[Quant V3] Document scoring latency=${Date.now() - startedAt}ms docs=${metrics.docs} docTokenPairs=${metrics.relevantDocTokenPairs} scored=${scoredDocuments.length} memCache=${metrics.memoryCacheHits} persistentCache=${metrics.persistentCacheHits} finbertCalls=${metrics.finbertCalls}`
  );

  return scoredDocuments;
}
