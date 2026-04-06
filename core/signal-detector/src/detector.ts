// core/signal-detector/src/detector.ts
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { MultiSignalResponseSchema, LlmSignalResponse } from "./llmZodSchema";
import { buildKnownTokensBlock, signalPromptTemplate } from "./prompt";
import { DetectorParams } from "./types";
import { GeminiClient } from "@gr2/shared/utils/gemini-client";
import { finBertProbs } from "./finbert";
import { SingleSignalSchema } from "./llmZodSchema";

// Khởi tạo Client với Key Rotation
const getGeminiClient = () => {
  return new GeminiClient({
    apiKeys: [
      process.env.GOOGLE_API_KEY_DETECTOR,
      process.env.GOOGLE_API_KEY_DETECTOR_2
    ].filter((k): k is string => !!k), // Lọc key undefined
    modelName: "gemini-2.5-flash-lite", // Hoặc flash-latest
    temperature: 0.1,
  });
};

/**
 * Helper: Lấy username từ URL tweet
 */
function getUsernameFromUrl(url: string): string {
  try {
    const match = url.match(/x\.com\/([^\/]+)\/status/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function detectSignalWithLlm(params: DetectorParams): Promise<LlmSignalResponse> {
    const { formattedTweets, knownTokens } = params;
    // Chỉ lấy tối đa 100 tokens
    const limitedTokens = Array.isArray(knownTokens) ? knownTokens.slice(0, 100) : [];
    // Lọc các tweet chưa từng tạo signal
    // Giả sử có hàm getUsedTweetIds() trả về mảng các tweetId đã dùng
    // TODO: Replace with actual DB query or persistence logic
    async function getUsedTweetIds(): Promise<string[]> {
      // Dummy: return [] for now, implement actual logic
      return [];
    }
    const usedTweetIds = await getUsedTweetIds();
    const newTweets = formattedTweets.filter(t => !usedTweetIds.includes(t.id));
    // Nếu không có tweet mới, trả về signals rỗng
    if (newTweets.length === 0) {
      console.log('[Detector] No new tweets found. Skipping signal generation.');
      return { signals: [] };
    }
    // Không giới hạn số lượng, dùng toàn bộ tweet mới
    const slimTweets = newTweets.map(t => ({
      id: t.id,
      text: t.text,
      author: t.author,
      time: t.time,
      url: t.url
    }));

      // Sau khi nhận kết quả từ AI, nếu signal không có tokenAddress nhưng có tokenSymbol, thì gán tokenAddress = tokenSymbol
      function normalizeSignalToken(signal: any) {
        if (!signal.tokenAddress || signal.tokenAddress === 'unknown') {
          if (signal.tokenSymbol) {
            signal.tokenAddress = signal.tokenSymbol;
          }
        }
        // Lọc và giới hạn relatedTweetIds
        if (Array.isArray(signal.relatedTweetIds)) {
          // Loại bỏ trùng lặp và chỉ lấy tối đa 20 ID
          signal.relatedTweetIds = Array.from(new Set(signal.relatedTweetIds)).slice(0, 20);
        }
        return signal;
      }

      // Khi xử lý signals, gọi normalizeSignalToken cho từng signal
    // 1. Parser
    const parser = StructuredOutputParser.fromZodSchema(MultiSignalResponseSchema as any);
    const formatInstructions = parser.getFormatInstructions();

    // 2. Chuẩn bị dữ liệu prompt
    const knownTokensBlock = buildKnownTokensBlock(limitedTokens);

  try {
    console.log(`[Detector] Aggregating ${slimTweets.length} new tweets for ${limitedTokens.length} tokens...`);
    // 3. Format Prompt
    const promptContent = await signalPromptTemplate.format({
      knownTokensBlock: knownTokensBlock,
      formattedTweets: JSON.stringify(slimTweets, null, 2),
      formatInstructions: formatInstructions, 
    });

    // 4. GỌI API (Sử dụng GeminiClient Shared)
    const gemini = getGeminiClient();

    // Thêm delay để tránh rate limit
    await new Promise(resolve => setTimeout(resolve, 2000)); // nghỉ 2s trước khi gọi API

    const rawResponseText = await gemini.generateJson(promptContent);

    // 5. Clean & Parse JSON
    // Remove markdown code block if exists
    let contentString = rawResponseText.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();

    const parsedResult = await parser.parse(contentString);
    
    // 6. Enrich Sources (Logic cũ của bạn - Giữ nguyên vì nó quan trọng)
    const validSignals = (parsedResult as any).signals
      .filter((s: any) => s.signalDetected)
      .map((signal: any) => {
        // Lọc và giới hạn relatedTweetIds trước khi enrich
        const normalizedSignal = normalizeSignalToken(signal);
        const sources = (normalizedSignal.relatedTweetIds || []).map((id: any) => {
          const originalTweet = formattedTweets.find((t: any) => t.id === id);
          
          if (originalTweet) {
            let author = originalTweet.author;
            if ((!author || author === 'unknown' || author === 'i') && originalTweet.url) {
                author = getUsernameFromUrl(originalTweet.url);
            }
            return {
              label: `Twitter (@${author})`, 
              url: originalTweet.url || `https://x.com/${author}/status/${id}`
            };
          }
          return { label: "Twitter", url: `https://x.com/i/web/status/${id}` };
        });

        return {
          ...normalizedSignal,
          sources: sources.length > 0 ? sources : normalizedSignal.sources 
        };
      });

    console.log(`[Detector] AI Identified ${validSignals.length} valid signals.`);
    return { signals: validSignals } as any;

  } catch (error) {
    console.error("[Detector] Error during LLM aggregation:", error);
    // Trả về mảng rỗng thay vì crash
    return { signals: [] };
  }
}


function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function symbolMentionRegex(symbol: string): RegExp | null {
  const s = symbol.trim();
  if (!s) return null;
  const escaped = escapeRegex(s);
  // Match symbol with optional "$" and avoid matching inside words too aggressively.
  // Example: SOL matches "... SOL ..." and "... $SOL ...", but not "... X_SOLX ..."
  return new RegExp(`(?:^|[^\\w])\\$?${escaped}(?:[^\\w]|$)`, "i");
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

const DEFAULT_BUY_THRESHOLD = 0.2;
const DEFAULT_SELL_THRESHOLD = -0.2;
const DEFAULT_MIN_TWEETS_PER_TOKEN = 2;
function quantile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = Math.floor((sorted.length - 1) * q);
  const v = sorted[Math.max(0, Math.min(sorted.length - 1, pos))];
  return Number.isFinite(v) ? v : null;
}

/**
 * Robust scaling (recommended):
 * EngagementMultiplier = 1 + log(1+engagement)/P90(log(1+engagement))
 *
 * - Avoid choosing fixed K
 * - Prevent domination by outliers
 */
function robustEngagementMultiplier(engagement: number, p90Log1p: number): number {
  if (!Number.isFinite(engagement) || engagement <= 0) return 1;
  const denom = p90Log1p > 0 ? p90Log1p : 1;
  return 1 + Math.log(1 + engagement) / denom;
}

/**
 * Quant signal detection using FinBERT probabilities from HuggingFace.
 *
 * Behavior notes:
 * - You asked to "send full tweet content to FinBERT", so we do not truncate.
 * - If a tweet mentions multiple tokens, we reuse the same FinBERT sentiment for each matched token.
 *   (More precise token-scoped sentiment is possible later by slicing around the token mention.)
 */
export async function detectSignalWithFinBertQuant(
  params: DetectorParams
): Promise<LlmSignalResponse> {
  const { formattedTweets, knownTokens } = params;

  const buyThreshold = Number(process.env.FINBERT_BUY_THRESHOLD ?? DEFAULT_BUY_THRESHOLD);
  const sellThreshold = Number(process.env.FINBERT_SELL_THRESHOLD ?? DEFAULT_SELL_THRESHOLD);
  const minTweetsPerToken = Number(
    process.env.FINBERT_MIN_TWEETS_PER_TOKEN ?? DEFAULT_MIN_TWEETS_PER_TOKEN
  );

  // Pre-compute robust engagement scaling denominator (P90 over batch)
  const engagementLogs = formattedTweets
    .map((t) => (t.replyCount ?? 0) + (t.retweetCount ?? 0) + (t.likeCount ?? 0))
    .map((eng) => Math.log(1 + Math.max(0, eng)));
  const p90Log1p = quantile(engagementLogs, 0.9) ?? 1;

  const tokenMatchers = knownTokens
    .map((t) => {
      const symbolRe = symbolMentionRegex(t.symbol);
      const nameLower = t.name?.toLowerCase?.() ?? "";
      return { token: t, symbolRe, nameLower };
    })
    .filter((x) => Boolean(x.symbolRe || x.nameLower));

  type Evidence = {
    tweetId: string;
    baseScore: number;
    authorWeight: number;
    engagementMultiplier: number;
  };
  const byTokenSymbol = new Map<string, Evidence[]>();

  for (const tweet of formattedTweets) {
    const text = tweet.text ?? "";
    if (!text.trim()) continue;

    // 1) match tokens in this tweet (heuristic)
    const matched = tokenMatchers.filter((m) => {
      if (m.symbolRe && m.symbolRe.test(text)) return true;
      if (m.nameLower && text.toLowerCase().includes(m.nameLower)) return true;
      return false;
    });

    if (matched.length === 0) continue;

    // 2) FinBERT inference once per tweet (full content)
    let baseScore = 0;
    try {
      const probs = await finBertProbs(text);
      baseScore = probs.baseScore; // pPos - pNeg in [-1,1] approx
    } catch (e) {
      console.error("[FinBERT] inference failed, skipping tweet:", e);
      continue;
    }

    // 3) engagement multiplier (null => 0)
    const replyCount = tweet.replyCount ?? 0;
    const retweetCount = tweet.retweetCount ?? 0;
    const likeCount = tweet.likeCount ?? 0;
    const engagement = replyCount + retweetCount + likeCount;
    const engagementMultiplier = robustEngagementMultiplier(engagement, p90Log1p);

    // 3b) AuthorWeight (from run-detection.ts)
    const authorWeight = tweet.authorWeight ?? 1.0;

    // 4) assign evidence to all matched tokens
    for (const m of matched) {
      const symbol = m.token.symbol;
      const arr = byTokenSymbol.get(symbol) ?? [];
      arr.push({
        tweetId: tweet.id,
        baseScore,
        authorWeight,
        engagementMultiplier,
      });
      byTokenSymbol.set(symbol, arr);
    }
  }

  // 5) aggregate per token => SingleSignal objects
  const signals: SingleSignal[] = [];

  for (const token of knownTokens) {
    const symbol = token.symbol;
    const evidence = byTokenSymbol.get(symbol);
    if (!evidence || evidence.length === 0) continue;
    if (evidence.length < minTweetsPerToken) continue;

    // finalScore ~= weighted average of baseScore by engagementMultiplier
    let numerator = 0;
    let denom = 0;
    for (const ev of evidence) {
      numerator += ev.baseScore * ev.authorWeight * ev.engagementMultiplier;
      denom += ev.authorWeight * ev.engagementMultiplier;
    }
    const finalScore = denom > 0 ? numerator / denom : 0;

    const action =
      finalScore >= buyThreshold ? "BUY" : finalScore <= sellThreshold ? "SELL" : "HOLD";

    const abs = Math.abs(finalScore);
    const evidenceFactor = clamp01(evidence.length / 3);
    // keep confidence in 0..100
    const confidence = Math.round(100 * clamp01(Math.tanh(abs)) * evidenceFactor);

    const signalDetected = action !== "HOLD" || confidence >= 25;

    if (!signalDetected) continue;

    const sortedEvidence = [...evidence].sort(
      (a, b) =>
        Math.abs(b.baseScore * b.authorWeight * b.engagementMultiplier) -
        Math.abs(a.baseScore * a.authorWeight * a.engagementMultiplier)
    );
    const top = sortedEvidence.slice(0, 8);

    const reason = [
      `FinBERT aggregation for ${symbol} using full tweet text.`,
      `Weighted finalScore=${finalScore.toFixed(3)} (weighted by authorWeight * engagementMultiplier; N=${evidence.length}).`,
      `Thresholds: buy>=${buyThreshold}, sell<=${sellThreshold}.`,
      `Action=${action}, confidence=${confidence}/100.`,
    ].join(" ");

    signals.push({
      signalDetected: true,
      tokenSymbol: symbol,
      confidence,
      reason,
      action,
      relatedTweetIds: top.map((t) => t.tweetId),
    });
  }

  return { signals };
}