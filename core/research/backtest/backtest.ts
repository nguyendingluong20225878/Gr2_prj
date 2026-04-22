import { finBertProbs } from "./finbert";
import { clamp, mean, std } from "./stats";
import { siteHostFromUrl, type RecentNewsArticle, type TokenRef } from "./newsStage2";

export type PricePoint = { timestamp: Date; priceUsd: number };

export function nearestPrice(points: PricePoint[], at: Date): number | null {
  if (!points.length) return null;
  const t = at.getTime();
  let best: PricePoint | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const p of points) {
    const d = Math.abs(p.timestamp.getTime() - t);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best ? best.priceUsd : null;
}

export function logReturn(p0: number, p1: number): number {
  if (!(p0 > 0) || !(p1 > 0)) return 0;
  return Math.log(p1 / p0);
}

export function pearsonCorr(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den > 0 ? num / den : 0;
}

export type SiteIcRow = { siteHost: string; ic: number; sampleCount: number; siteWeight: number };

export async function computeSiteWeightsFromNews(params: {
  articles: RecentNewsArticle[];
  tokens: TokenRef[]; // symbol->coingeckoId
  priceByTokenKey: Map<string, PricePoint[]>; // coingeckoId -> series
  horizonHours: number;
  k: number; // weight = 1 + k*IC
  clipLo?: number;
  clipHi?: number;
}): Promise<SiteIcRow[]> {
  const symToCg = new Map<string, string>();
  for (const t of params.tokens) if (t.coingeckoId) symToCg.set(t.symbol.toUpperCase(), t.coingeckoId);

  // collect per site
  const bySite = new Map<string, Array<{ score: number; ret: number }>>();

  for (const a of params.articles) {
    const text = `${a.title ?? ""}\n${a.summary ?? ""}`.trim();
    if (!text) continue;
    const publishedAt = a.publishedAt ?? a.scrapedAt;
    const t1 = new Date(publishedAt.getTime() + params.horizonHours * 3600 * 1000);

    const probs = await finBertProbs(text);
    const score = probs.baseScore;

    const tokenKeys = (a.detectedTokens ?? [])
      .map((sym) => symToCg.get(String(sym).toUpperCase()) ?? null)
      .filter((x): x is string => Boolean(x));
    if (!tokenKeys.length) continue;

    for (const tokenKey of tokenKeys) {
      const series = params.priceByTokenKey.get(tokenKey) ?? [];
      const p0 = nearestPrice(series, publishedAt);
      const p1 = nearestPrice(series, t1);
      if (p0 == null || p1 == null) continue;
      const ret = logReturn(p0, p1);

      const host = siteHostFromUrl(a.siteUrl);
      const arr = bySite.get(host) ?? [];
      arr.push({ score, ret });
      bySite.set(host, arr);
    }
  }

  const out: SiteIcRow[] = [];
  for (const [siteHost, rows] of bySite.entries()) {
    const xs = rows.map((r) => r.score);
    const ys = rows.map((r) => r.ret);
    const ic = pearsonCorr(xs, ys);
    const siteWeight = clamp(1 + params.k * ic, params.clipLo ?? 0.5, params.clipHi ?? 1.5);
    out.push({ siteHost, ic, sampleCount: rows.length, siteWeight });
  }
  return out;
}

export type DynWeights = {
  icTwitter: number;
  icNews: number;
  varTwitter: number;
  varNews: number;
  wTwitter: number;
  wNews: number;
};

export function computeDynamicWeightsFromSeries(params: {
  twitterScores: number[];
  newsScores: number[];
  twitterReturns: number[];
  newsReturns: number[];
  a: number; // blend
}): DynWeights {
  const icTwitter = pearsonCorr(params.twitterScores, params.twitterReturns);
  const icNews = pearsonCorr(params.newsScores, params.newsReturns);
  const varTwitter = Math.pow(std(params.twitterScores), 2) || 1;
  const varNews = Math.pow(std(params.newsScores), 2) || 1;

  const wTwVar = 1 / varTwitter;
  const wNVar = 1 / varNews;
  const sVar = wTwVar + wNVar;
  const twVarN = wTwVar / sVar;
  const nVarN = wNVar / sVar;

  const twIc = Math.max(icTwitter, 0);
  const nIc = Math.max(icNews, 0);
  const sIc = twIc + nIc || 1;
  const twIcN = twIc / sIc;
  const nIcN = nIc / sIc;

  const wTwitter = params.a * twVarN + (1 - params.a) * twIcN;
  const wNews = params.a * nVarN + (1 - params.a) * nIcN;
  const s = wTwitter + wNews || 1;

  return {
    icTwitter,
    icNews,
    varTwitter,
    varNews,
    wTwitter: wTwitter / s,
    wNews: wNews / s,
  };
}

