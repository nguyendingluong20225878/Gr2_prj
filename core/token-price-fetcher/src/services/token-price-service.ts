import {
  tokensTable,
  tokenPriceHistory,
  tokenPricesTable,
  Logger,
} from "@gr2/shared";
import {
  fetchMarketChartRangeFromCoingecko,
  fetchPricesFromCoingecko,
} from "./providers/coingecko.provider.js";

const logger = new Logger("TokenPriceService");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type HistoricalPricePoint = { timestamp: Date; priceUsd: number };

export type BackfillTokenPriceHistoryOptions = {
  days?: number;
  delayMs?: number;
  tokenIds?: string[];
  intervalHours?: number;
  maxRetries?: number;
  retryDelayMs?: number;
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

export class TokenPriceService {
    async getTokenPrice(tokenAddress: string): Promise<number | null> {
      // Tìm giá token theo address
      const priceDoc = await tokenPricesTable.findOne({ tokenKey: tokenAddress }).lean();
      return priceDoc?.priceUsd ?? null;
    }

    async updateAllTokenPrices(): Promise<void> {
      await TokenPriceService.updatePrices();
    }
  static async updatePrices() {
    logger.info("Đang cập nhật giá coin...");

    const tokens = await tokensTable
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
    const now = new Date();
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const tokenFilter: Record<string, unknown> = {
      coingeckoId: { $exists: true, $ne: null },
    };
    if (options.tokenIds?.length) {
      tokenFilter.coingeckoId = { $in: options.tokenIds };
    }

    const tokens = await tokensTable
      .find(tokenFilter, { _id: 1, coingeckoId: 1, symbol: 1, address: 1 })
      .sort({ symbol: 1 })
      .lean();

    if (tokens.length === 0) {
      logger.warn("Không có token nào có coingeckoId để backfill lịch sử giá");
      return { tokens: 0, points: 0 };
    }

    let totalPoints = 0;
    let failedTokens = 0;
    for (const token of tokens) {
      const coingeckoId = token.coingeckoId;
      if (!coingeckoId) continue;

      logger.info(`Backfill lịch sử giá ${token.symbol} (${coingeckoId}) ${days} ngày...`);

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
        continue;
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
    }

    return { tokens: tokens.length, points: totalPoints, failedTokens };
  }
}
