import {
  connectToDatabase,
  newsArticlesTable,
  tokenPriceHistory,
  tokensTable,
  tweetTable,
} from "@gr2/shared";
import {
  detectSignalWithFinBertQuant,
  DetectorHyperParams,
  FormattedNews,
  FormattedTweet,
  KnownTokenType,
} from "../../signal-detector/src/index.js";
import {
  evaluateVirtualProposals,
  EvaluatorPricePoint,
  PnlEvaluationResult,
  VirtualProposal,
} from "./pnl-evaluator.js";

export type ReplayBacktestOptions = {
  candidate: DetectorHyperParams;
  from: Date;
  to: Date;
  stepHours: number;
  lookbackHours: number;
  horizonHours: number;
  feeRate: number;
  slippageRate: number;
  notionalUsd: number;
  sparseMaxDistanceMs: number;
};

type TokenRef = KnownTokenType & {
  coingeckoId?: string | null;
};

function toNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(value as any);
  return Number.isFinite(date.getTime()) ? date : null;
}

function buildAsOfSchedule(from: Date, to: Date, stepHours: number): Date[] {
  const out: Date[] = [];
  const stepMs = stepHours * 60 * 60 * 1000;
  for (let t = from.getTime(); t <= to.getTime(); t += stepMs) {
    out.push(new Date(t));
  }
  return out;
}

async function loadKnownTokens(): Promise<TokenRef[]> {
  const rows = await tokensTable
    .find(
      { coingeckoId: { $exists: true, $ne: null } },
      { symbol: 1, name: 1, address: 1, coingeckoId: 1 }
    )
    .lean();

  return rows.map((token: any) => ({
    symbol: String(token.symbol),
    name: String(token.name ?? token.symbol),
    address: token.address ?? token.coingeckoId ?? undefined,
    coingeckoId: token.coingeckoId ?? null,
  }));
}

async function loadSnapshotDocs(asOf: Date, lookbackHours: number) {
  const from = new Date(asOf.getTime() - lookbackHours * 60 * 60 * 1000);

  const [tweets, news] = await Promise.all([
    tweetTable
      .find({ tweetTime: { $gte: from, $lte: asOf } })
      .sort({ tweetTime: 1 })
      .lean(),
    newsArticlesTable
      .find({ scrapedAt: { $gte: from, $lte: asOf } })
      .sort({ scrapedAt: 1 })
      .lean(),
  ]);

  const formattedTweets: FormattedTweet[] = tweets.map((tweet: any) => ({
    id: String(tweet._id),
    text: String(tweet.content ?? ""),
    author: String(tweet.authorId ?? "unknown_author"),
    time: new Date(tweet.tweetTime).toISOString(),
    url: tweet.url,
    replyCount: tweet.replyCount ?? 0,
    retweetCount: tweet.retweetCount ?? 0,
    likeCount: tweet.likeCount ?? 0,
  }));

  const formattedNews: FormattedNews[] = news.map((article: any) => ({
    siteUrl: String(article.siteUrl ?? ""),
    articleUrl: String(article.articleUrl ?? ""),
    title: String(article.title ?? ""),
    summary: String(article.summary ?? ""),
    content: String(article.content ?? ""),
    publishedAt: asDate(article.publishedAt),
    scrapedAt: asDate(article.scrapedAt) ?? asOf,
    detectedTokens: Array.isArray(article.detectedTokens)
      ? article.detectedTokens.map(String)
      : [],
  }));

  return { formattedTweets, formattedNews };
}

async function loadPriceSeries(
  tokenRefs: TokenRef[],
  from: Date,
  to: Date
): Promise<{
  priceByTokenKey: Map<string, EvaluatorPricePoint[]>;
  tokenKeysBySymbol: Map<string, string[]>;
  tokenKeysByAddress: Map<string, string[]>;
}> {
  const allKeys = new Set<string>();
  const tokenKeysBySymbol = new Map<string, string[]>();
  const tokenKeysByAddress = new Map<string, string[]>();

  for (const token of tokenRefs) {
    const keys = [
      token.address,
      token.coingeckoId,
      token.coingeckoId ? `coingecko:${token.coingeckoId}` : null,
    ].filter((key): key is string => Boolean(key));

    keys.forEach((key) => allKeys.add(key));
    tokenKeysBySymbol.set(token.symbol, keys);
    if (token.address) tokenKeysByAddress.set(token.address, keys);
  }

  const rows = await tokenPriceHistory
    .find({
      tokenAddress: { $in: [...allKeys] },
      timestamp: { $gte: from, $lte: to },
    })
    .sort({ timestamp: 1 })
    .lean();

  const priceByTokenKey = new Map<string, EvaluatorPricePoint[]>();
  for (const row of rows as any[]) {
    const price = toNumber(row.priceUsd);
    if (!price) continue;

    const key = String(row.tokenAddress);
    const arr = priceByTokenKey.get(key) ?? [];
    arr.push({ timestamp: new Date(row.timestamp), priceUsd: price });
    priceByTokenKey.set(key, arr);
  }

  return { priceByTokenKey, tokenKeysBySymbol, tokenKeysByAddress };
}

function signalToVirtualProposal(signal: any, asOf: Date, index: number): VirtualProposal {
  return {
    id: `${asOf.toISOString()}-${signal.tokenSymbol}-${index}`,
    tokenSymbol: String(signal.tokenSymbol),
    tokenAddress: String(signal.tokenAddress ?? signal.tokenSymbol),
    suggestionType: String(signal.suggestionType),
    detectedAt: asOf,
  };
}

export async function replayCandidateBacktest(
  options: ReplayBacktestOptions
): Promise<PnlEvaluationResult & { virtualProposalCount: number; snapshots: number }> {
  await connectToDatabase();

  const tokenRefs = await loadKnownTokens();
  const asOfSchedule = buildAsOfSchedule(options.from, options.to, options.stepHours);
  const virtualProposals: VirtualProposal[] = [];
  const historicalData: Record<string, Array<{ asOf: Date; unifiedRaw: number }>> = {};

  for (const asOf of asOfSchedule) {
    const { formattedTweets, formattedNews } = await loadSnapshotDocs(
      asOf,
      options.lookbackHours
    );
    if (formattedTweets.length === 0 && formattedNews.length === 0) continue;

    const signals = await detectSignalWithFinBertQuant({
      formattedTweets,
      formattedNews,
      knownTokens: tokenRefs,
      historicalData,
      hyperParams: options.candidate,
      asOf,
      throttleMs: 0,
      chunkDelayMs: 0,
    });

    signals.forEach((signal, index) => {
      virtualProposals.push(signalToVirtualProposal(signal, asOf, index));
      const symbol = String(signal.tokenSymbol);
      const unifiedRaw = Number(signal.metadata?.scoreComponents?.unifiedRaw);
      if (symbol && Number.isFinite(unifiedRaw)) {
        const history = historicalData[symbol] ?? [];
        history.push({ asOf, unifiedRaw });
        historicalData[symbol] = history.slice(-30);
      }
    });
  }

  const priceWindowFrom = new Date(
    options.from.getTime() - options.sparseMaxDistanceMs
  );
  const priceWindowTo = new Date(
    options.to.getTime() +
      options.horizonHours * 60 * 60 * 1000 +
      options.sparseMaxDistanceMs
  );
  const {
    priceByTokenKey,
    tokenKeysBySymbol,
    tokenKeysByAddress,
  } = await loadPriceSeries(tokenRefs, priceWindowFrom, priceWindowTo);

  const result = evaluateVirtualProposals(virtualProposals, priceByTokenKey, {
    horizonHours: options.horizonHours,
    feeRate: options.feeRate,
    slippageRate: options.slippageRate,
    notionalUsd: options.notionalUsd,
    sparseMaxDistanceMs: options.sparseMaxDistanceMs,
    tokenKeysBySymbol,
    tokenKeysByAddress,
  });

  return {
    ...result,
    virtualProposalCount: virtualProposals.length,
    snapshots: asOfSchedule.length,
  };
}
