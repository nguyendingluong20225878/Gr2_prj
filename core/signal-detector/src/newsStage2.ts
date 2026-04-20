import { finBertProbs } from "./finbert";
import { mean, std, weightedAvg, zscores } from "./stats";

export type TokenRef = { symbol: string; coingeckoId: string | null };

export type RecentNewsArticle = {
  siteUrl: string;
  articleUrl: string;
  title: string;
  summary: string;
  content: string;
  publishedAt: Date | null;
  scrapedAt: Date;
  detectedTokens: string[]; // currently may be symbols
};

export type SourceWeight = { siteHost: string; siteWeight: number };

export type NewsEvidence = {
  tokenKey: string; // coingeckoId
  siteHost: string;
  articleUrl: string;
  publishedAt: Date;
  baseScore: number;
  recencyMultiplier: number;
  siteWeight: number;
  rawScore: number;
  z: number;
};

export function siteHostFromUrl(siteUrl: string): string {
  try {
    const u = new URL(siteUrl);
    return u.host.replace(/^www\./, "");
  } catch {
    return siteUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

export function recencyMultiplier(publishedAt: Date, now: Date): number {
  const ageHours = (now.getTime() - publishedAt.getTime()) / 3_600_000;
  if (!Number.isFinite(ageHours)) return 1;
  if (ageHours <= 0) return 1.5;
  if (ageHours >= 48) return 1;
  return 1 + 0.5 * (48 - ageHours) / 48;
}

export function buildSymbolToCoingeckoIdMap(tokens: TokenRef[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of tokens) {
    if (!t.coingeckoId) continue;
    m.set(t.symbol.toUpperCase(), t.coingeckoId);
  }
  return m;
}

export function buildSiteWeightMap(weights: SourceWeight[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of weights) m.set(w.siteHost, w.siteWeight);
  return m;
}

export async function scoreRecentNewsToEvidence(params: {
  articles: RecentNewsArticle[];
  tokens: TokenRef[];
  siteWeights: SourceWeight[]; // if empty => 1.0
  now?: Date;
}): Promise<NewsEvidence[]> {
  const now = params.now ?? new Date();
  const symToCg = buildSymbolToCoingeckoIdMap(params.tokens);
  const siteW = buildSiteWeightMap(params.siteWeights);

  const tmp: Omit<NewsEvidence, "z">[] = [];

  for (const a of params.articles) {
    const text = `${a.title ?? ""}\n${a.summary ?? ""}`.trim();
    if (!text) continue;

    const probs = await finBertProbs(text);
    const baseScore = probs.baseScore;

    const publishedAt = a.publishedAt ?? a.scrapedAt;
    const mr = recencyMultiplier(publishedAt, now);
    const host = siteHostFromUrl(a.siteUrl);
    const sw = siteW.get(host) ?? 1.0;

    // Map detected tokens -> coingeckoId (skip if not found)
    const tokenKeys = (a.detectedTokens ?? [])
      .map((sym) => symToCg.get(String(sym).toUpperCase()) ?? null)
      .filter((x): x is string => Boolean(x));

    if (tokenKeys.length === 0) continue;

    const rawScore = baseScore * mr * sw;

    for (const tokenKey of tokenKeys) {
      tmp.push({
        tokenKey,
        siteHost: host,
        articleUrl: a.articleUrl,
        publishedAt,
        baseScore,
        recencyMultiplier: mr,
        siteWeight: sw,
        rawScore,
      });
    }
  }

  const rawScores = tmp.map((x) => x.rawScore);
  const z = zscores(rawScores);

  return tmp.map((x, i) => ({ ...x, z: z[i] }));
}

export function aggregateNewsByToken(evidence: NewsEvidence[]): Map<string, { newsScore: number; nArticles: number; topUrls: string[] }> {
  const byToken = new Map<string, NewsEvidence[]>();
  for (const ev of evidence) {
    const arr = byToken.get(ev.tokenKey) ?? [];
    arr.push(ev);
    byToken.set(ev.tokenKey, arr);
  }

  const out = new Map<string, { newsScore: number; nArticles: number; topUrls: string[] }>();

  for (const [tokenKey, arr] of byToken.entries()) {
    const values = arr.map((x) => x.z);
    const weights = arr.map((x) => x.recencyMultiplier * x.siteWeight);
    const score = weightedAvg(values, weights);
    const top = [...arr]
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
      .slice(0, 5)
      .map((x) => x.articleUrl);

    out.set(tokenKey, { newsScore: score, nArticles: arr.length, topUrls: top });
  }

  return out;
}

