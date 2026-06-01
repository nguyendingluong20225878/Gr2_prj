import {
  tokensTable,
  tokenPriceHistory,
  tokenPricesTable,
  Logger,
  proposalsTable,
  signalsTable,
} from "@gr2/shared";
import {
  fetchMarketChartRangeFromCoingecko,
  fetchPricesFromCoingecko,
} from "./providers/coingecko.provider.js";

const logger = new Logger("TokenPriceService");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type HistoricalPricePoint = { timestamp: Date; priceUsd: number };
type TokenBackfillRow = {
  _id: unknown;
  address?: string | null;
  coingeckoId?: string | null;
  symbol?: string | null;
};

export type BackfillTokenPriceHistoryOptions = {
  concurrency?: number;
  days?: number;
  delayMs?: number;
  existingToleranceMinutes?: number;
  intervalHours?: number;
  maxRetries?: number;
  recentOnlyDays?: number;
  retryDelayMs?: number;
  skipExisting?: boolean;
  targetHoursAgo?: number;
  tokenIds?: string[];
};

function downsamplePricePoints(
  points: HistoricalPricePoint[],
  intervalHours: number
): HistoricalPricePoint[] {
  if (intervalHours <= 0) return points;

  const intervalMs = intervalHours * 60 * 60 * 1000;
  const buckets = new Map<number, HistoricalPricePoint>();

  for (const point of points) {
    const bucketMs =
      Math.floor(point.timestamp.getTime() / intervalMs) * intervalMs;

    if (!buckets.has(bucketMs)) {
      buckets.set(bucketMs, {
        timestamp: new Date(bucketMs),
        priceUsd: point.priceUsd,
      });
    }
  }

  return Array.from(buckets.values()).sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.floor(Number(value));
  return normalized > 0 ? normalized : fallback;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
}

async function loadRecentTokenHints(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [proposals, signals] = await Promise.all([
    (proposalsTable as any)
      .find(
        { createdAt: { $gte: since } },
        { tokenAddress: 1, tokenSymbol: 1 }
      )
      .lean(),
    (signalsTable as any)
      .find(
        {
          $or: [
            { detectedAt: { $gte: since } },
            { createdAt: { $gte: since } },
          ],
        },
        { tokenAddress: 1, tokenSymbol: 1 }
      )
      .lean(),
  ]);

  const symbols = new Set<string>();
  const addresses = new Set<string>();
  for (const row of [...proposals, ...signals] as any[]) {
    if (row.tokenSymbol) symbols.add(String(row.tokenSymbol).toUpperCase());
    if (row.tokenAddress) {
      const address = String(row.tokenAddress);
      addresses.add(address);
      if (address.startsWith("coingecko:")) {
        addresses.add(address.replace("coingecko:", ""));
      }
    }
  }

  return { addresses, symbols };
}

async function hasExistingHistoricalPriceNear(params: {
  coingeckoId: string;
  address?: string | null;
  targetAt: Date;
  toleranceMinutes: number;
}) {
  const toleranceMs = params.toleranceMinutes * 60 * 1000;
  const from = new Date(params.targetAt.getTime() - toleranceMs);
  const to = new Date(params.targetAt.getTime() + toleranceMs);
  const keys = [
    params.coingeckoId,
    `coingecko:${params.coingeckoId}`,
    params.address,
  ].filter((key): key is string => Boolean(key));

  const existing = await tokenPriceHistory
    .findOne({
      tokenAddress: { $in: keys },
      timestamp: { $gte: from, $lte: to },
    })
    .lean();

  return Boolean(existing);
}

export class TokenPriceService {
    async getTokenPrice(tokenAddress: string): Promise<number | null> {
      const token = await tokensTable
        .findOne({
          $or: [
            { address: tokenAddress },
            { coingeckoId: tokenAddress.replace(/^coingecko:/, "") },
          ],
        })
        .lean();

      const candidateKeys = new Set([tokenAddress]);
      if (token?.coingeckoId) {
        candidateKeys.add(token.coingeckoId);
        candidateKeys.add(`coingecko:${token.coingeckoId}`);
      }

      const priceDoc = await tokenPricesTable
        .findOne({
          $or: [
            { tokenKey: { $in: [...candidateKeys] } },
            { tokenAddress },
            ...(token?._id ? [{ token: token._id }] : []),
          ],
        })
        .lean();
      return priceDoc?.priceUsd ?? null;
    }

    async updateAllTokenPrices(): Promise<void> {
      await TokenPriceService.updatePrices();
    }
  static async updatePrices() {
    logger.info("Đang cập nhật giá coin...");

    const tokens: TokenBackfillRow[] = await (tokensTable as any)
      .find(
        { coingeckoId: { $exists: true } },
        { _id: 1, coingeckoId: 1, symbol: 1 }
      )
      .lean();

    if (tokens.length === 0) {
      logger.warn("Không có coin nào có coingeckoId");
      return;
    }

    const ids = tokens.map((t) => t.coingeckoId!);
    const prices = await fetchPricesFromCoingecko(ids);

    const bulkOps = tokens
      .map((t) => {
        const price = prices[t.coingeckoId!];
        if (!price) return null;

        return {
          updateOne: {
            filter: {
              tokenKey: `coingecko:${t.coingeckoId}`,
            },
            update: {
              $set: {
                tokenKey: `coingecko:${t.coingeckoId}`,
                token: t._id,
                priceUsd: price,
                source: "coingecko",
                lastUpdated: new Date(),
              },
            },
            upsert: true,
          },
        };
      })
      .filter(Boolean);

    if (bulkOps.length === 0) {
      logger.warn("No token prices to update.");
      return;
    }

    await tokenPricesTable.bulkWrite(bulkOps as any);

    logger.info(`Đã cập nhật giá ${bulkOps.length} coin`);
  }

  static async backfillHistoricalPrices(
    options: BackfillTokenPriceHistoryOptions = {}
  ) {
    const days = options.days ?? 30;
    const delayMs = options.delayMs ?? 1500;
    const intervalHours = options.intervalHours ?? 1;
    const maxRetries = options.maxRetries ?? 3;
    const retryDelayMs = options.retryDelayMs ?? 10_000;
    const concurrency = positiveInteger(options.concurrency, 1);
    const skipExisting = options.skipExisting ?? false;
    const targetHoursAgo = options.targetHoursAgo ?? 24;
    const existingToleranceMinutes =
      options.existingToleranceMinutes ?? Math.max(90, intervalHours * 60);
    const now = new Date();
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const tokenFilter: Record<string, unknown> = {
      coingeckoId: { $exists: true, $ne: null },
    };
    if (options.tokenIds?.length) {
      tokenFilter.coingeckoId = { $in: options.tokenIds };
    }

    let tokens: TokenBackfillRow[] = await (tokensTable as any)
      .find(tokenFilter, { _id: 1, coingeckoId: 1, symbol: 1, address: 1 })
      .sort({ symbol: 1 })
      .lean();

    if (options.recentOnlyDays && options.recentOnlyDays > 0) {
      const hints = await loadRecentTokenHints(options.recentOnlyDays);
      tokens = tokens.filter((token) => {
        const symbol = token.symbol ? String(token.symbol).toUpperCase() : "";
        const coingeckoId = token.coingeckoId ? String(token.coingeckoId) : "";
        const address = token.address ? String(token.address) : "";
        return (
          hints.symbols.has(symbol) ||
          hints.addresses.has(coingeckoId) ||
          hints.addresses.has(`coingecko:${coingeckoId}`) ||
          hints.addresses.has(address)
        );
      });
    }

    if (tokens.length === 0) {
      logger.warn("Không có token nào có coingeckoId để backfill lịch sử giá");
      return { tokens: 0, points: 0 };
    }

    let totalPoints = 0;
    let failedTokens = 0;
    let skippedExisting = 0;
    const targetAt = new Date(now.getTime() - targetHoursAgo * 60 * 60 * 1000);

    await runWithConcurrency(tokens, concurrency, async (token) => {
      const coingeckoId = token.coingeckoId;
      if (!coingeckoId) return;

      logger.info(`Backfill lịch sử giá ${token.symbol} (${coingeckoId}) ${days} ngày...`);

      if (
        skipExisting &&
        await hasExistingHistoricalPriceNear({
          address: token.address,
          coingeckoId,
          targetAt,
          toleranceMinutes: existingToleranceMinutes,
        })
      ) {
        skippedExisting += 1;
        logger.info(`Bỏ qua ${token.symbol} (${coingeckoId}) vì đã có giá gần ${targetHoursAgo}h trước`);
        return;
      }

      let points: HistoricalPricePoint[] = [];
      let success = false;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          points = await fetchMarketChartRangeFromCoingecko(
            coingeckoId,
            Math.floor(from.getTime() / 1000),
            Math.floor(now.getTime() / 1000)
          );
          success = true;
          points = downsamplePricePoints(points, intervalHours);
          break;
        } catch (error) {
          const isLastAttempt = attempt >= maxRetries;
          const waitMs = retryDelayMs * Math.pow(2, attempt);
          logger.warn(
            `Lỗi backfill ${token.symbol} (${coingeckoId}) attempt ${attempt + 1}/${maxRetries + 1}`,
            { error: String(error), retryInMs: isLastAttempt ? 0 : waitMs }
          );

          if (isLastAttempt) break;
          await sleep(waitMs);
        }
      }

      if (!success) {
        failedTokens += 1;
        logger.warn(`Bỏ qua ${token.symbol} (${coingeckoId}) sau khi retry thất bại`);
        if (delayMs > 0) await sleep(delayMs);
        return;
      }

      const bulkOps = points.map((point) => ({
        updateOne: {
          filter: {
            tokenAddress: coingeckoId,
            timestamp: point.timestamp,
          },
          update: {
            $set: {
              tokenAddress: coingeckoId,
              token: token._id,
              priceUsd: String(point.priceUsd),
              timestamp: point.timestamp,
              source: "coingecko",
            },
          },
          upsert: true,
        },
      }));

      if (bulkOps.length > 0) {
        await tokenPriceHistory.bulkWrite(bulkOps as any);
      }

      totalPoints += bulkOps.length;
      logger.info(`Đã backfill ${bulkOps.length} điểm giá cho ${token.symbol}`);

      if (delayMs > 0) await sleep(delayMs);
    });

    return {
      tokens: tokens.length,
      points: totalPoints,
      failedTokens,
      skippedExisting,
    };
  }
}
