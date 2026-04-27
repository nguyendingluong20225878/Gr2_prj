import { finBertProbs } from "./finbert";
import { zscores, weightedAvg, quantile, clamp } from "./stats";
import { aggregateTwitterSignals, PreScoredEvidence } from "./twitter-aggregator";
import { aggregateNewsByToken } from "./news-aggregator";
import { DetectorParams, PreScoredNewsEvidence } from "./types";

// ==========================================
// QuantOutput
// ==========================================
export interface QuantOutput {
  tokenSymbol: string;
  quantScore: number;         // Z-Score tổng hợp cuối cùng
  sentimentType: "positive" | "negative" | "neutral";
  newsEvidences: string[];    // Danh sách URL bài báo
  tweetEvidences: string[];   // Danh sách URL bài tweet
}

// ==========================================
// HÀM HELPER & REGEX
// ==========================================
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}//Tránh lỗi khi symbol có ký tự đặc biệt

function getRecencyMultiplier(publishedAt: Date | null): number {
  if (!publishedAt) return 1;
  const hoursOld = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
  if (hoursOld < 2) return 2.0;   // Tin nóng: x2
  if (hoursOld < 6) return 1.5;   // Tin mới: x1.5
  if (hoursOld < 24) return 1.2;
  return 1.0;
}//time decay

// ==========================================
// QUANT ENGINE (DUAL-TRACK)
// ==========================================
export async function detectSignalWithFinBertQuant(params: DetectorParams): Promise<QuantOutput[]> {
  const { formattedNews, formattedTweets, knownTokens } = params;

  // Chuẩn bị Regex Token
  const tokenMatchers = knownTokens.map(t => ({
    symbol: t.symbol,
    regex: new RegExp(`(?:^|[^\\w])\\$?${escapeRegex(t.symbol)}(?:[^\\w]|$)`, "i")
  }));

  // ==========================================
  // TRACK 1: XỬ LÝ NEWS
  // ==========================================
  const rawNewsEvidences: PreScoredNewsEvidence[] = [];
  
  for (const n of formattedNews) {
    if (!n.detectedTokens || n.detectedTokens.length === 0) continue;

    const textForAi = `${n.title}. ${n.summary}`;
    const probs = await finBertProbs(textForAi);//output : baseScore [-1,1]

    const siteWeight = n.siteUrl.includes("coindesk") || n.siteUrl.includes("cointelegraph") ? 2 : 1;
    const finalWeight = siteWeight * getRecencyMultiplier(n.publishedAt);

    for (const token of n.detectedTokens) {
      rawNewsEvidences.push({
        tokenKey: token,
        articleUrl: n.articleUrl,
        zScore: 0, 
        rawScore: probs.baseScore * finalWeight, // Điểm nháp chờ chuẩn hóa
        finalWeight
      });
    }
  }//rawScore : trước normalize

  // Chuẩn hóa Z-Score cho News
  const newsScoresArray = rawNewsEvidences.map((x: any) => x.rawScore);
  const newsZ = zscores(newsScoresArray, 0.1);
  //z = (x - mean) / std
  rawNewsEvidences.forEach((n, idx) => n.zScore = newsZ[idx]);

  // Gom nhóm News
  const aggregatedNews = aggregateNewsByToken(rawNewsEvidences);


  // ==========================================
  // TRACK 2: XỬ LÝ TWEETS
  // ==========================================
  const rawTweetEvidences: PreScoredEvidence[] = [];
  
  const engagementLogs = formattedTweets.map(t => (t.replyCount || 0) + (t.retweetCount || 0) + (t.likeCount || 0));
  const p90Log1p = engagementLogs.length > 0 ? Math.log(1 + quantile(engagementLogs, 0.9)) : 1;
  //Dùng P90 để tránh outlier

  for (const t of formattedTweets) {
    const mentionedTokens = tokenMatchers.filter(m => m.regex.test(t.text)).map(m => m.symbol);
    if (mentionedTokens.length === 0) continue;

    const probs = await finBertProbs(t.text);

    const engagement = (t.replyCount || 0) + (t.retweetCount || 0) + (t.likeCount || 0);
    const denom = p90Log1p > 0 ? p90Log1p : 1;
    const engagementMultiplier = 1 + Math.log(1 + engagement) / denom;
    //1 + log(1 + engagement) / denom
    const finalWeight = (t.authorWeight || 1) * engagementMultiplier;

    for (const token of mentionedTokens) {
      rawTweetEvidences.push({
        tweetId: t.id,
        tokenKey: token,
        url: t.url || `https://x.com/i/status/${t.id}`,
        zScore: 0,
        rawScore: probs.baseScore * finalWeight, // Điểm nháp chờ chuẩn hóa
        finalWeight
      });
    }
  }

  // Chuẩn hóa Z-Score cho Tweets
  const tweetScoresArray = rawTweetEvidences.map((x: any) => x.rawScore);
  const tweetZ = zscores(tweetScoresArray, 0.1);
  //z = (x - mean) / std
  rawTweetEvidences.forEach((t, idx) => t.zScore = tweetZ[idx]);

  // Gom nhóm Tweets
  const aggregatedTweets = aggregateTwitterSignals(rawTweetEvidences);


  // ==========================================
  // MERGE THEO TOKEN (CROSS-AGGREGATION)
  // ==========================================
  const results: QuantOutput[] = [];
  
  // Có thể thay đổi các hằng số này sau khi chạy Backtest
  const WEIGHT_NEWS = 0.60;    // 60% sức mạnh từ Báo chí
  const WEIGHT_TWITTER = 0.40; // 40% sức mạnh từ Mạng xã hội

  const allTokens = Array.from(new Set([
    ...Array.from(aggregatedNews.keys()),
    ...Array.from(aggregatedTweets.byTokenKey.keys())
  ]));

  for (const symbol of allTokens) {
    const newsData = aggregatedNews.get(symbol);
    const tweetData = aggregatedTweets.byTokenKey.get(symbol);

    let finalQuantScore = 0;
    const newsUrls = newsData ? newsData.topUrls : [];
    const tweetUrls = tweetData ? tweetData.topTweetIds : [];

    if (newsData && tweetData) {
      // Nếu có cả 2 nguồn: Áp dụng tỷ lệ %
      finalQuantScore = (newsData.newsScore * WEIGHT_NEWS) + (tweetData.twitterScore * WEIGHT_TWITTER);
    } else if (newsData) {
      // Chỉ có News: Lấy 100% sức mạnh của News
      finalQuantScore = newsData.newsScore;
    } else if (tweetData) {
      // Chỉ có Twitter: Lấy 100% sức mạnh của Twitter
      finalQuantScore = tweetData.twitterScore;
    }

    let sentimentType: "positive" | "negative" | "neutral" = "neutral";
    if (finalQuantScore > 1.0) sentimentType = "positive";
    else if (finalQuantScore < -1.0) sentimentType = "negative";

    // Lọc tín hiệu nhiễu (Chỉ lấy |Z-Score| > 0.5)
    if (Math.abs(finalQuantScore) > 0.5) {
      results.push({
        tokenSymbol: symbol,
        quantScore: finalQuantScore,
        sentimentType,
        newsEvidences: newsUrls,
        tweetEvidences: tweetUrls
      });
    }
  }

  return results;
}