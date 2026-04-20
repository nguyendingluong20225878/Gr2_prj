//tổng hợp=> Nó gộp dữ liệu từ Twitter và News dựa trên tokenKey
import { finBertProbs } from "./finbert";
import { zscores, weightedAvg, clamp } from "./stats";
import {
  aggregateNewsByToken,
  scoreRecentNewsToEvidence,
  type RecentNewsArticle,
  type SourceWeight,
  type TokenRef,
} from "./newsStage2";

export type Stage2Tweet = {
  id: string;
  text: string;
  url?: string;
  authorWeight: number;
  replyCount: number;
  retweetCount: number;
  likeCount: number;
  // token attribution (coingeckoIds)
  tokenKeys: string[];
};

export type Stage2Signal = {
  tokenKey: string; // coingeckoId
  action: "BUY" | "SELL" | "HOLD";
  confidencePct: number; // 0..100
  finalScore: number;
  zFinal: number;
  twitterScore?: number;
  newsScore?: number;
  sources: Array<{ label: string; url: string }>;
  metadata: Record<string, unknown>;
};

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = Math.floor((sorted.length - 1) * q);
  return sorted[Math.max(0, Math.min(sorted.length - 1, pos))];
}

function robustEngagementMultiplier(engagement: number, p90Log1p: number): number {
  if (!Number.isFinite(engagement) || engagement <= 0) return 1;
  const denom = p90Log1p > 0 ? p90Log1p : 1;
  return 1 + Math.log(1 + engagement) / denom;
}

export async function computeTwitterScores(params: {
  tweets: Array<{
    id: string;
    text: string;
    url?: string;
    authorWeight?: number;
    replyCount?: number | null;
    retweetCount?: number | null;
    likeCount?: number | null;
    tokenKeys: string[]; // coingeckoIds
  }>;
}): Promise<{
  byTokenKey: Map<string, { twitterScore: number; nTweets: number; topTweetIds: string[] }>;
  evidenceCount: number;
}> {
  const tweets = params.tweets.filter((t) => t.tokenKeys.length > 0 && (t.text ?? "").trim().length > 0);
  if (!tweets.length) return { byTokenKey: new Map(), evidenceCount: 0 };

  const engagementLogs = tweets
    .map((t) => (t.replyCount ?? 0) + (t.retweetCount ?? 0) + (t.likeCount ?? 0))
    .map((eng) => Math.log(1 + Math.max(0, eng)));
  const p90 = quantile(engagementLogs, 0.9) || 1;

  // Compute raw scores per tweet (FinBERT once per tweet)
  const rawScores: number[] = [];
  const tweetScores: Array<{
    tweetId: string;
    url?: string;
    tokenKeys: string[];
    weight: number;
    raw: number;
  }> = [];

  for (const t of tweets) {
    const probs = await finBertProbs(t.text);
    const base = probs.baseScore;
    const eng = (t.replyCount ?? 0) + (t.retweetCount ?? 0) + (t.likeCount ?? 0);
    const em = robustEngagementMultiplier(eng, p90);
    const aw = t.authorWeight ?? 1.0;
    const raw = base * aw * em;
    const weight = aw * em;

    rawScores.push(raw);
    tweetScores.push({ tweetId: t.id, url: t.url, tokenKeys: t.tokenKeys, weight, raw });
  }

  const z = zscores(rawScores);
  tweetScores.forEach((x, i) => (x.raw = z[i])); // reuse "raw" slot as zscore

  // Aggregate per tokenKey
  const perToken = new Map<string, Array<{ z: number; w: number; tweetId: string; url?: string }>>();
  for (const ts of tweetScores) {
    for (const k of ts.tokenKeys) {
      const arr = perToken.get(k) ?? [];
      arr.push({ z: ts.raw, w: ts.weight, tweetId: ts.tweetId, url: ts.url });
      perToken.set(k, arr);
    }
  }

  const byTokenKey = new Map<string, { twitterScore: number; nTweets: number; topTweetIds: string[] }>();
  for (const [k, arr] of perToken.entries()) {
    const score = weightedAvg(
      arr.map((x) => x.z),
      arr.map((x) => x.w)
    );
    const top = [...arr].sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 5).map((x) => x.tweetId);
    byTokenKey.set(k, { twitterScore: score, nTweets: arr.length, topTweetIds: top });
  }

  return { byTokenKey, evidenceCount: tweetScores.length };
}

export async function computeStage2Signals(params: {
  tokenRefs: TokenRef[]; // symbol->coingeckoId
  tweets: Array<{
    id: string;
    text: string;
    url?: string;
    authorWeight?: number;
    replyCount?: number | null;
    retweetCount?: number | null;
    likeCount?: number | null;
    tokenKeys: string[]; // coingeckoId list
  }>;
  newsArticles: RecentNewsArticle[];
  siteWeights: SourceWeight[]; // if empty => 1.0
  dynamicWeights?: { wTwitter: number; wNews: number } | null;
}): Promise<Stage2Signal[]> {
  const now = new Date();

  const twitter = await computeTwitterScores({ tweets: params.tweets });

  const newsEvidence = await scoreRecentNewsToEvidence({
    articles: params.newsArticles,
    tokens: params.tokenRefs,
    siteWeights: params.siteWeights,
    now,
  });
  const newsByToken = aggregateNewsByToken(newsEvidence);

  // Merge token universe
  const tokenKeys = new Set<string>();
  for (const k of twitter.byTokenKey.keys()) tokenKeys.add(k);
  for (const k of newsByToken.keys()) tokenKeys.add(k);

  // Determine weights
  let wTw = params.dynamicWeights?.wTwitter;
  let wNews = params.dynamicWeights?.wNews;
  if (!Number.isFinite(wTw ?? NaN) || !Number.isFinite(wNews ?? NaN) || (wTw ?? 0) <= 0 || (wNews ?? 0) <= 0) {
    // fallback equal weights if we have both sources; otherwise 1 for existing source
    wTw = twitter.byTokenKey.size > 0 ? 0.5 : 0;
    wNews = newsByToken.size > 0 ? 0.5 : 0;
    const s = (wTw ?? 0) + (wNews ?? 0);
    if (s === 0) return [];
    wTw = (wTw ?? 0) / s;
    wNews = (wNews ?? 0) / s;
  } else {
    const s = (wTw ?? 0) + (wNews ?? 0);
    wTw = (wTw ?? 0) / s;
    wNews = (wNews ?? 0) / s;
  }

  // Compute final scores for each tokenKey
  const rows: Array<{
    tokenKey: string;
    twitterScore: number | null;
    newsScore: number | null;
    nEvidence: number;
    finalScore: number;
  }> = [];

  for (const k of tokenKeys) {
    const tw = twitter.byTokenKey.get(k);
    const nw = newsByToken.get(k);
    const twitterScore = tw?.twitterScore ?? null;
    const newsScore = nw?.newsScore ?? null;
    const nEvidence = (tw?.nTweets ?? 0) + (nw?.nArticles ?? 0);

    const finalScore =
      (twitterScore != null ? wTw * twitterScore : 0) + (newsScore != null ? wNews * newsScore : 0);
    rows.push({ tokenKey: k, twitterScore, newsScore, nEvidence, finalScore });
  }

  // z-score across tokens
  const zFinal = zscores(rows.map((r) => r.finalScore));

  const signals: Stage2Signal[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const z = zFinal[i];
    const action: "BUY" | "SELL" | "HOLD" = z > 1 ? "BUY" : z < -1 ? "SELL" : "HOLD";

    const confRaw = Math.abs(z) * Math.sqrt(Math.max(1, r.nEvidence));
    const confidencePct = Math.round(100 * clamp(Math.tanh(confRaw / 2), 0, 1));

    if (action === "HOLD" && confidencePct < 25) continue;

    const sources: Array<{ label: string; url: string }> = [];
    // we only have IDs/urls for news top urls; twitter runner can enrich later if desired
    const nw = newsByToken.get(r.tokenKey);
    if (nw) {
      for (const url of nw.topUrls.slice(0, 3)) sources.push({ label: "News", url });
    }

    signals.push({
      tokenKey: r.tokenKey,
      action,
      confidencePct,
      finalScore: r.finalScore,
      zFinal: z,
      twitterScore: r.twitterScore ?? undefined,
      newsScore: r.newsScore ?? undefined,
      sources,
      metadata: {
        wTwitter: wTw,
        wNews,
        nEvidence: r.nEvidence,
        nTweets: twitter.byTokenKey.get(r.tokenKey)?.nTweets ?? 0,
        nArticles: newsByToken.get(r.tokenKey)?.nArticles ?? 0,
      },
    });
  }

  return signals;
}

