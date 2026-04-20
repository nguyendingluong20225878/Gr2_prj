import { connectToDatabase } from "../../shared/src/db/connection.js";
import { newsArticlesTable } from "../../shared/src/db/schema/news_articles.js";
import { tokensTable } from "../../shared/src/db/schema/tokens.js";
import { tokenPriceHistory } from "../../shared/src/db/schema/token_price_history.js";
import { sourceWeightsTable } from "../../shared/src/db/schema/source_weights.js";
import { signalWeightsTable } from "../../shared/src/db/schema/signal_weights.js";

import type { RecentNewsArticle, TokenRef } from "./newsStage2";
import { computeSiteWeightsFromNews, type PricePoint, computeDynamicWeightsFromSeries } from "./backtest";
import { clamp } from "./stats";

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function loadPricesForTokenKeys(tokenKeys: string[], from: Date, to: Date): Promise<Map<string, PricePoint[]>> {
  await connectToDatabase();
  const rows = await tokenPriceHistory
    .find({
      tokenAddress: { $in: tokenKeys },
      timestamp: { $gte: from, $lte: to },
    })
    .sort({ timestamp: 1 })
    .lean();

  const map = new Map<string, PricePoint[]>();
  for (const r of rows) {
    const key = String((r as any).tokenAddress);
    const price = toNum((r as any).priceUsd);
    const ts = new Date((r as any).timestamp);
    if (!price) continue;
    const arr = map.get(key) ?? [];
    arr.push({ timestamp: ts, priceUsd: price });
    map.set(key, arr);
  }
  return map;
}

export async function runBacktestUpdateSourceWeights(params?: { horizonHours?: number; windowDays?: number; k?: number }) {
  const horizonHours = params?.horizonHours ?? 24;
  const windowDays = params?.windowDays ?? 60;
  const k = params?.k ?? 1.0;

  await connectToDatabase();

  const now = new Date();
  const from = new Date(now.getTime() - windowDays * 24 * 3600 * 1000);
  const to = new Date(now.getTime() + horizonHours * 3600 * 1000);

  const tokens = await tokensTable.find({ coingeckoId: { $exists: true, $ne: null } }).lean();
  const tokenRefs: TokenRef[] = tokens.map((t: any) => ({ symbol: String(t.symbol), coingeckoId: t.coingeckoId ?? null }));
  const tokenKeys = tokenRefs.map((t) => t.coingeckoId).filter((x): x is string => Boolean(x));

  const articles = (await newsArticlesTable
    .find({ scrapedAt: { $gte: from } })
    .select({ siteUrl: 1, articleUrl: 1, title: 1, summary: 1, content: 1, publishedAt: 1, scrapedAt: 1, detectedTokens: 1 })
    .lean()) as any as RecentNewsArticle[];

  const priceByTokenKey = await loadPricesForTokenKeys(tokenKeys, from, to);

  const rows = await computeSiteWeightsFromNews({
    articles,
    tokens: tokenRefs,
    priceByTokenKey,
    horizonHours,
    k,
    clipLo: 0.5,
    clipHi: 1.5,
  });

  for (const r of rows) {
    await sourceWeightsTable.updateOne(
      { siteHost: r.siteHost },
      {
        $set: {
          siteHost: r.siteHost,
          horizonHours,
          windowDays,
          sampleCount: r.sampleCount,
          ic: r.ic,
          siteWeight: r.siteWeight,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  return { updated: rows.length };
}

// MVP: compute global weights from DB stored weights (or fallback equal)
export async function runBacktestUpdateSignalWeights(params?: { horizonHours?: number; windowDays?: number; a?: number }) {
  const horizonHours = params?.horizonHours ?? 24;
  const windowDays = params?.windowDays ?? 60;
  const a = params?.a ?? 0.5;

  // Placeholder: until you persist historical TwitterScore/NewsScore series per token,
  // we store a neutral default. This file is ready for you to plug those series in.
  const w = computeDynamicWeightsFromSeries({
    twitterScores: [0, 0, 0, 0],
    newsScores: [0, 0, 0, 0],
    twitterReturns: [0, 0, 0, 0],
    newsReturns: [0, 0, 0, 0],
    a: clamp(a, 0, 1),
  });

  await connectToDatabase();
  await signalWeightsTable.create({
    horizonHours,
    windowDays,
    icTwitter: w.icTwitter,
    icNews: w.icNews,
    varTwitter: w.varTwitter,
    varNews: w.varNews,
    wTwitter: w.wTwitter,
    wNews: w.wNews,
    updatedAt: new Date(),
  });

  return { created: true, w };
}

