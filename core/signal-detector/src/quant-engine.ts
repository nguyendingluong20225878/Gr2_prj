import { finBertProbs } from "./finbert";
import { zscores, quantile, clamp } from "./stats";
import { aggregateTwitterSignals, PreScoredEvidence } from "./twitter-aggregator";
import { DetectorParams, QuantSignalResponse } from "./types"; // Cần đảm bảo file types.ts có SingleSignal

// Các hàm regex heuristic của bạn giữ nguyên
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function symbolMentionRegex(symbol: string): RegExp | null {
  const s = symbol.trim();
  if (!s) return null;
  const escaped = escapeRegex(s);
  return new RegExp(`(?:^|[^\\w])\\$?${escaped}(?:[^\\w]|$)`, "i");
}

function robustEngagementMultiplier(engagement: number, p90Log1p: number): number {
  if (!Number.isFinite(engagement) || engagement <= 0) return 1;
  const denom = p90Log1p > 0 ? p90Log1p : 1;
  return 1 + Math.log(1 + engagement) / denom;
}

export async function detectSignalWithFinBertQuant(params: DetectorParams) {
  const { formattedTweets, knownTokens } = params;

  // 1. TÍNH TOÁN P90 CHO TRỌNG SỐ ENGAGEMENT
  const engagementLogs = formattedTweets
    .map((t) => (t.replyCount ?? 0) + (t.retweetCount ?? 0) + (t.likeCount ?? 0))
    .map((eng) => Math.log(1 + Math.max(0, eng)));
  const p90Log1p = quantile(engagementLogs, 0.9) ?? 1;

  // 2. CHUẨN BỊ BỘ LỌC TOKEN (Tối ưu biên dịch Regex 1 lần)
  const tokenMatchers = knownTokens
    .map((t) => ({
      token: t,
      symbolRe: symbolMentionRegex(t.symbol),
      nameLower: t.name?.toLowerCase?.() ?? "",
    }))
    .filter((x) => Boolean(x.symbolRe || x.nameLower));

  // 3. GỌI FINBERT API SONG SONG (Fix lỗi Thắt cổ chai)
  // Thực tế nếu data > 500 tweets, bạn nên dùng thư viện p-limit để chia batch, tránh nghẽn API.
  const scoredTweets = await Promise.all(
    formattedTweets.map(async (tweet) => {
      const text = tweet.text ?? "";
      if (!text.trim()) return { ...tweet, baseScore: 0, matchedTokens: [] };

      const matchedTokens = tokenMatchers
        .filter(m => (m.symbolRe && m.symbolRe.test(text)) || (m.nameLower && text.toLowerCase().includes(m.nameLower)))
        .map(m => m.token);

      if (matchedTokens.length === 0) return { ...tweet, baseScore: 0, matchedTokens: [] };

      try {
        const probs = await finBertProbs(text);
        return { ...tweet, baseScore: probs.baseScore, matchedTokens };
      } catch (e) {
        console.error(`[FinBERT] Failed for tweet ${tweet.id}`, e);
        return { ...tweet, baseScore: 0, matchedTokens };
      }
    })
  );

  // 4. ÁP DỤNG TRỌNG SỐ CHO TỪNG SỰ KIỆN (EVENT-LEVEL)
  const rawEvidences: (PreScoredEvidence & { rawScore: number })[] = [];

  for (const tweet of scoredTweets) {
    if (tweet.matchedTokens.length === 0 || tweet.baseScore === 0) continue;

    const engagement = (tweet.replyCount ?? 0) + (tweet.retweetCount ?? 0) + (tweet.likeCount ?? 0);
    const engagementMultiplier = robustEngagementMultiplier(engagement, p90Log1p);
    const authorWeight = tweet.authorWeight ?? 1.0;
    
    const finalWeight = authorWeight * engagementMultiplier;
    const rawScore = tweet.baseScore * finalWeight;

    for (const token of tweet.matchedTokens) {
      rawEvidences.push({
        tweetId: tweet.id,
        tokenKey: token.symbol,
        url: tweet.url,
        finalWeight,
        rawScore, // Tạm thời giữ lại để chuẩn hóa
        zScore: 0 // Sẽ điền sau
      });
    }
  }

  // 5. CHUẨN HÓA EVENT-LEVEL (Z-SCORE MỨC TWEET TOÀN CỤC)
  // Sử dụng zscores đã có cơ chế chống khuếch đại nhiễu (minStd = 0.05)
  const allRawScores = rawEvidences.map(e => e.rawScore);
  const allZ = zscores(allRawScores, 0.05); 
  
  const normalizedEvidences: PreScoredEvidence[] = rawEvidences.map((e, i) => ({
    tweetId: e.tweetId,
    tokenKey: e.tokenKey,
    finalWeight: e.finalWeight,
    zScore: allZ[i]
  }));

  // 6. GOM NHÓM THEO TOKEN QUA STAGE 2
  const twitterResults = aggregateTwitterSignals(normalizedEvidences);

  // 7. XUẤT KẾT QUẢ CUỐI CÙNG QUA CROSS-TOKEN Z-SCORE
  const signals: QuantSignalResponse[] = [];
  const tokenSymbols = Array.from(twitterResults.byTokenKey.keys());
  const tokenScores = tokenSymbols.map(sym => twitterResults.byTokenKey.get(sym)!.twitterScore);
  
  const tokenScoreZ = zscores(tokenScores, 0.1); 

  for (let i = 0; i < tokenSymbols.length; i++) {
    const symbol = tokenSymbols[i];
    const data = twitterResults.byTokenKey.get(symbol)!;
    const z = tokenScoreZ[i];
    const n = data.nTweets;

    const action = z > 1 ? "buy" : z < -1 ? "sell" : "hold";
    
    const confRaw = Math.abs(z) * Math.log10(Math.min(n + 1, 100)); 
    const confidence = Math.round(100 * clamp(Math.tanh(confRaw), 0, 1));

    if (action === "hold" && confidence < 25) continue;

    // Đẩy thẳng symbol vào, không cần map ra address nữa
    signals.push({
      signalDetected: true,
      tokenSymbol: symbol, // <-- Ghi nhận trực tiếp Token Symbol
      sources: [], 
      sentimentScore: clamp(z / 3, -1, 1), 
      suggestionType: action,
      strength: confidence,           
      confidence: confidence / 100,   
      reasoning: `Hệ thống Quant Z-Score: ${symbol} đạt điểm ${data.twitterScore.toFixed(3)}, Z-Score chéo: ${z.toFixed(2)}. Tín hiệu tự động chống nhiễu.`,
      relatedTweetIds: data.topTweetIds,
      impactScore: null,
    });
  }

  return { signals };
}