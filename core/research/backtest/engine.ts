import {
  backtestResultsTable,
  connectToDatabase,
  Logger,
  proposalsTable,
  signalsTable,
  tokenPriceHistory,
  tokensTable,
} from "@gr2/shared";
import { TokenPriceService } from "../../token-price-fetcher/src/index.js";
import {
  calculateBacktestTradePnl,
  resolveBacktestDirection,
} from "./trade-math.js";

type WinLossStatus = "WIN" | "LOSS" | "BREAKEVEN";
type DataQuality = "OK" | "SPARSE" | "FALLBACK_CURRENT_PRICE";

export type BacktestEngineOptions = {
  from?: Date;
  to?: Date;
  horizonHours?: number;
  batchSize?: number;
  delayMs?: number;
  batchDelayMs?: number;
  feeRate?: number;
  slippageRate?: number;
  notionalUsd?: number;
  holdMoveThreshold?: number;
  sparseMaxDistanceMs?: number;
  persist?: boolean;
  allowCurrentPriceFallback?: boolean;
};

export type BacktestSummary = {
  scanned: number;
  evaluated: number;
  skipped: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalPnL: number;
  totalPnlPercentage: number;
  endingPnl: number;
  endingEquity: number;
  maxDrawdownUsd: number;
};

type PricePoint = {
  timestamp: Date;
  priceUsd: number;
};

const logger = new Logger("BacktestEngine");

const DEFAULTS = {
  horizonHours: 24,
  batchSize: 25,
  delayMs: 350,
  batchDelayMs: 1500,
  feeRate: 0.001,
  slippageRate: 0.001,
  notionalUsd: 1000,
  holdMoveThreshold: 0.01,
  sparseMaxDistanceMs: 6 * 60 * 60 * 1000,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function positiveNumberOrDefault(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function nonNegativeNumberOrDefault(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : fallback;
}

function positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.floor(Number(value));
  return normalized > 0 ? normalized : fallback;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function resolveSignalDetectedAt(proposal: any): Promise<Date | null> {
  if (proposal.detectedAt) return new Date(proposal.detectedAt);

  if (proposal.signalId) {
    const signal = await (signalsTable as any)
      .findById(proposal.signalId, { detectedAt: 1, createdAt: 1 })
      .lean();
    const signalSource = signal?.detectedAt ?? signal?.createdAt;
    if (signalSource) return new Date(signalSource);
  }

  return null;
}

async function resolveEntryAt(proposal: any): Promise<Date> {
  const signalDetectedAt = await resolveSignalDetectedAt(proposal);
  if (signalDetectedAt) return signalDetectedAt;

  const source = proposal.createdAt ?? proposal.updatedAt;
  return source ? new Date(source) : new Date();
}

function resolveExpiresAt(proposal: any, entryAt: Date, horizonHours: number): Date {
  if (proposal.expiresAt) return new Date(proposal.expiresAt);
  return new Date(entryAt.getTime() + horizonHours * 60 * 60 * 1000);
}

function nearestPrice(points: PricePoint[], at: Date) {
  let best: PricePoint | null = null;
  let bestDistanceMs = Number.POSITIVE_INFINITY;

  for (const point of points) {
    const distanceMs = Math.abs(point.timestamp.getTime() - at.getTime());
    if (distanceMs < bestDistanceMs) {
      best = point;
      bestDistanceMs = distanceMs;
    }
  }

  return best ? { ...best, distanceMs: bestDistanceMs } : null;
}

function riskLevelFromBacktest(params: {
  dataQuality: DataQuality;
  pnlPercentage: number;
  winLossStatus: WinLossStatus;
}): "LOW" | "MEDIUM" | "HIGH" {
  if (params.dataQuality !== "OK") return "HIGH";
  if (params.winLossStatus === "LOSS") return "HIGH";
  if (Math.abs(params.pnlPercentage) < 0.005) return "MEDIUM";
  return "LOW";
}

async function resolveTokenKeys(proposal: any): Promise<string[]> {
  const keys = new Set<string>();
  const tokenAddress = String(proposal.tokenAddress ?? "").trim();
  const tokenSymbol = String(proposal.tokenSymbol ?? "").trim();
  const hasGenericNativeAddress = tokenAddress.toLowerCase() === "native";

  if (tokenAddress && !hasGenericNativeAddress) keys.add(tokenAddress);
  if (tokenAddress.startsWith("coingecko:")) {
    keys.add(tokenAddress.replace("coingecko:", ""));
  }

  const tokenFilters: Record<string, string>[] = [];
  if (tokenAddress && !hasGenericNativeAddress) tokenFilters.push({ address: tokenAddress });
  if (tokenAddress && !hasGenericNativeAddress) {
    tokenFilters.push({ coingeckoId: tokenAddress.replace("coingecko:", "") });
  }
  if (tokenSymbol) tokenFilters.push({ symbol: tokenSymbol.toUpperCase() });

  const token = tokenFilters.length
    ? await (tokensTable as any).findOne({ $or: tokenFilters }).lean()
    : null;

  if (token?.address) keys.add(String(token.address));
  if (token?.coingeckoId) {
    keys.add(String(token.coingeckoId));
    keys.add(`coingecko:${token.coingeckoId}`);
  }

  return [...keys];
}

async function loadHistoricalPrices(
  tokenKeys: string[],
  from: Date,
  to: Date
): Promise<PricePoint[]> {
  if (!tokenKeys.length) return [];

  const rows = await tokenPriceHistory
    .find({
      tokenAddress: { $in: tokenKeys },
      timestamp: { $gte: from, $lte: to },
    })
    .sort({ timestamp: 1 })
    .lean();

  return rows
    .map((row: any) => ({
      timestamp: new Date(row.timestamp),
      priceUsd: toNumber(row.priceUsd),
    }))
    .filter((row): row is PricePoint => row.priceUsd !== null);
}

async function fallbackCurrentPrice(
  tokenKeys: string[],
  expiresAt: Date
): Promise<number | null> {
  const now = Date.now();
  const ageMs = Math.abs(now - expiresAt.getTime());
  if (ageMs > 2 * 60 * 60 * 1000) return null;

  const service = new TokenPriceService();
  for (const key of tokenKeys) {
    const price = await service.getTokenPrice(key);
    if (price && price > 0) return price;
  }

  return null;
}

export async function runProposalBacktest(
  options: BacktestEngineOptions = {}
): Promise<BacktestSummary> {
  await connectToDatabase();

  const horizonHours = positiveNumberOrDefault(
    options.horizonHours,
    DEFAULTS.horizonHours
  );
  const batchSize = positiveIntegerOrDefault(
    options.batchSize,
    DEFAULTS.batchSize
  );
  const delayMs = nonNegativeNumberOrDefault(
    options.delayMs,
    DEFAULTS.delayMs
  );
  const batchDelayMs = nonNegativeNumberOrDefault(
    options.batchDelayMs,
    DEFAULTS.batchDelayMs
  );
  const feeRate = nonNegativeNumberOrDefault(
    options.feeRate,
    DEFAULTS.feeRate
  );
  const slippageRate = nonNegativeNumberOrDefault(
    options.slippageRate,
    DEFAULTS.slippageRate
  );
  const notionalUsd = positiveNumberOrDefault(
    options.notionalUsd,
    DEFAULTS.notionalUsd
  );
  const holdMoveThreshold = nonNegativeNumberOrDefault(
    options.holdMoveThreshold,
    DEFAULTS.holdMoveThreshold
  );
  const sparseMaxDistanceMs = positiveNumberOrDefault(
    options.sparseMaxDistanceMs,
    DEFAULTS.sparseMaxDistanceMs
  );
  const persist = options.persist ?? true;
  const allowCurrentPriceFallback =
    options.allowCurrentPriceFallback ?? persist;

  const now = new Date();
  const fallbackMaturedBefore = new Date(
    now.getTime() - horizonHours * 60 * 60 * 1000
  );
  const query: Record<string, any> = {
    suggestionType: { $in: ["buy", "sell", "hold", "close_position", "stake"] },
    createdAt: { $lte: now },
    $or: [
      { expiresAt: { $lte: now } },
      {
        $and: [
          {
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: null },
            ],
          },
          { createdAt: { $lte: fallbackMaturedBefore } },
        ],
      },
    ],
  };

  if (options.from || options.to) {
    query.createdAt = {
      ...(options.from ? { $gte: options.from } : {}),
      ...(options.to ? { $lte: options.to } : {}),
    };
  }

  const proposals = await (proposalsTable as any)
    .find(query)
    .sort({ createdAt: 1 })
    .lean();
  let equity = 0;
  let peakEquity = 0;
  const summary: BacktestSummary = {
    scanned: proposals.length,
    evaluated: 0,
    skipped: 0,
    wins: 0,
    losses: 0,
    breakeven: 0,
    winRate: 0,
    totalPnL: 0,
    totalPnlPercentage: 0,
    endingPnl: 0,
    endingEquity: 0,
    maxDrawdownUsd: 0,
  };

  for (let i = 0; i < proposals.length; i += batchSize) {
    const batch = proposals.slice(i, i + batchSize);

    for (const proposal of batch as any[]) {
      const direction = resolveBacktestDirection(String(proposal.suggestionType));
      const [entryAt, signalDetectedAt] = await Promise.all([
        resolveEntryAt(proposal),
        resolveSignalDetectedAt(proposal),
      ]);
      const expiresAt = resolveExpiresAt(proposal, entryAt, horizonHours);

      if (!direction) {
        summary.skipped += 1;
        if (persist) {
          await proposalsTable.updateOne(
            { _id: proposal._id },
            {
              $set: {
                winLossStatus: "SKIPPED",
                backtestedAt: now,
                backtestMeta: {
                  reason: "unsupported_suggestion_type",
                  horizonHours,
                },
              },
            }
          );
        }
        continue;
      }

      if (expiresAt > now) {
        summary.skipped += 1;
        continue;
      }

      const tokenKeys = await resolveTokenKeys(proposal);
      const priceWindowStart = new Date(
        entryAt.getTime() - sparseMaxDistanceMs
      );
      const priceWindowEnd = new Date(expiresAt.getTime() + sparseMaxDistanceMs);
      const prices = await loadHistoricalPrices(
        tokenKeys,
        priceWindowStart,
        priceWindowEnd
      );

      const entry = nearestPrice(prices, entryAt);
      let exit = nearestPrice(prices, expiresAt);
      let dataQuality: DataQuality =
        prices.length < 2 ||
        !entry ||
        !exit ||
        entry.distanceMs > sparseMaxDistanceMs ||
        exit.distanceMs > sparseMaxDistanceMs
          ? "SPARSE"
          : "OK";

      if (
        entry &&
        allowCurrentPriceFallback &&
        (!exit || exit.distanceMs > sparseMaxDistanceMs)
      ) {
        const currentPrice = await fallbackCurrentPrice(tokenKeys, expiresAt);
        if (currentPrice) {
          exit = { timestamp: now, priceUsd: currentPrice, distanceMs: 0 };
          dataQuality = "FALLBACK_CURRENT_PRICE";
        }
      }

      if (!entry || !exit) {
        summary.skipped += 1;
        if (persist) {
          await proposalsTable.updateOne(
            { _id: proposal._id },
            {
              $set: {
                winLossStatus: "SKIPPED",
                backtestedAt: now,
                backtestMeta: {
                  reason: "missing_or_sparse_price_history",
                  tokenKeys,
                  entryAt,
                  signalDetectedAt,
                  expiresAt,
                  pricePoints: prices.length,
                },
              },
            }
          );
        }
        await sleep(delayMs);
        continue;
      }

      const result = calculateBacktestTradePnl({
        direction,
        entryPrice: entry.priceUsd,
        exitPrice: exit.priceUsd,
        feeRate,
        slippageRate,
        notionalUsd,
        holdMoveThreshold,
      });

      equity += result.actualPnL;
      peakEquity = Math.max(peakEquity, equity);
      summary.maxDrawdownUsd = Math.max(summary.maxDrawdownUsd, peakEquity - equity);
      summary.evaluated += 1;
      summary.totalPnL += result.actualPnL;
      summary.totalPnlPercentage += result.pnlPercentage;
      summary.endingPnl = equity;
      summary.endingEquity = equity;
      if (result.winLossStatus === "WIN") summary.wins += 1;
      if (result.winLossStatus === "LOSS") summary.losses += 1;
      if (result.winLossStatus === "BREAKEVEN") summary.breakeven += 1;

	      if (persist) {
        const legacyFinancialImpact = {
          ...(proposal.financialImpact ?? {}),
          currentValue: entry.priceUsd,
          projectedValue: exit.priceUsd,
          roi: result.pnlPercentage,
          percentChange: result.pnlPercentage,
          riskLevel: riskLevelFromBacktest({
            dataQuality,
            pnlPercentage: result.pnlPercentage,
            winLossStatus: result.winLossStatus,
          }),
        };

	        await proposalsTable.updateOne(
	          { _id: proposal._id },
	          {
	            $set: {
	              entryPrice: entry.priceUsd,
	              exitPrice: exit.priceUsd,
	              actualPnL: result.actualPnL,
                financialImpact: legacyFinancialImpact,
	              winLossStatus: result.winLossStatus,
              pnlPercentage: result.pnlPercentage,
              backtestedAt: now,
              backtestMeta: {
                direction,
                grossPnlPercentage: result.grossPnlPercentage,
                feeRate,
                slippageRate,
                notionalUsd,
                holdMoveThreshold,
                entryAt,
                signalDetectedAt,
                expiresAt,
                entryTimestamp: entry.timestamp,
                exitTimestamp: exit.timestamp,
                dataQuality,
              },
            },
          }
        );

        await backtestResultsTable.updateOne(
          { proposalId: proposal._id },
          {
            $set: {
              proposalId: proposal._id,
              signalId: proposal.signalId,
              tokenSymbol: proposal.tokenSymbol,
              tokenAddress: proposal.tokenAddress,
              suggestionType: proposal.suggestionType,
              detectedAt: entryAt,
              expiresAt,
              entryPrice: entry.priceUsd,
              exitPrice: exit.priceUsd,
              grossPnlPercentage: result.grossPnlPercentage,
              pnlPercentage: result.pnlPercentage,
              actualPnL: result.actualPnL,
              winLossStatus: result.winLossStatus,
              feeRate,
              slippageRate,
              notionalUsd,
              holdMoveThreshold,
              equityAfterTrade: equity,
              dataQuality,
            },
          },
          { upsert: true }
        );
      }

      await sleep(delayMs);
    }

    if (i + batchSize < proposals.length) {
      logger.info(`Backtest batch completed: ${i + batch.length}/${proposals.length}`);
      await sleep(batchDelayMs);
    }
  }

  summary.winRate =
    summary.evaluated > 0 ? summary.wins / summary.evaluated : 0;

  return summary;
}

export async function buildDashboardBacktestPayload() {
  await connectToDatabase();

  const rows = await backtestResultsTable.find({}).sort({ expiresAt: 1 }).lean();
  const wins = rows.filter((row) => row.winLossStatus === "WIN").length;
  const losses = rows.filter((row) => row.winLossStatus === "LOSS").length;
  const breakeven = rows.filter((row) => row.winLossStatus === "BREAKEVEN").length;
  const totalPnL = rows.reduce((sum, row) => sum + Number(row.actualPnL ?? 0), 0);

  return {
    summary: {
      totalTrades: rows.length,
      wins,
      losses,
      breakeven,
      winRate: rows.length ? wins / rows.length : 0,
      totalPnL,
      endingEquity: rows.at(-1)?.equityAfterTrade ?? 0,
    },
    winLoss: [
      { status: "WIN", count: wins },
      { status: "LOSS", count: losses },
      { status: "BREAKEVEN", count: breakeven },
    ],
    equityCurve: rows.map((row) => ({
      timestamp: row.expiresAt,
      equity: row.equityAfterTrade,
      pnl: row.actualPnL,
      pnlPercentage: row.pnlPercentage,
      tokenSymbol: row.tokenSymbol,
      suggestionType: row.suggestionType,
    })),
    trades: rows.map((row) => ({
      proposalId: String(row.proposalId),
      timestamp: row.expiresAt,
      tokenSymbol: row.tokenSymbol,
      suggestionType: row.suggestionType,
      entryPrice: row.entryPrice,
      exitPrice: row.exitPrice,
      pnlPercentage: row.pnlPercentage,
      actualPnL: row.actualPnL,
      winLossStatus: row.winLossStatus,
    })),
  };
}
