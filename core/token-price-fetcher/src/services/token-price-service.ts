type TokenSelect = any;

// Jupiter price response type
interface JupiterPriceResponse {
  data: {
    [tokenAddress: string]: {
      id: string;
      type: string;
      price: string;
    };
  };
  timeTaken: number;
}

interface TokenPriceUpdate {
  tokenAddress: string;
  priceUsd: string;
  lastUpdated: Date;
  source: string;
}

interface TokenPriceHistoryInsert {
  tokenAddress: string;
  priceUsd: string;
  timestamp: Date;
  source: string;
}

let cachedShared: any = null;
async function getSharedIfConfigured() {
  if (cachedShared) return cachedShared;

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    // DB not configured — log and return null to make persistence optional
    console.warn(
      "token-price-fetcher: MongoDB not configured (MONGODB_URI missing); persistence will be skipped",
    );
    return null;
  }

  const mongoose = await import("mongoose");
  await mongoose.connect(mongoUri);

  // Correct path: shared is a sibling of the `core` folder, so go up three levels to reach `core/shared`
  const shared = await import("../../../shared/src/index.js" as any);
  const { tokenPricesTable, tokenPriceHistory } = shared as any;

  cachedShared = {
    mongoose,
    tokenPricesTable,
    tokenPriceHistory,
    connection: mongoose.connection,
    logger: shared?.logger ?? console,
  };

  return cachedShared;
}

export class TokenPriceService {
  private jupiterApiUrl: string;
  private lastRefreshDate: Date | null = null;

  constructor() {
    this.jupiterApiUrl =
      process.env.JUPITER_API_URL || "https://api.jup.ag/price/v2";
  }

  async updateAllTokenPrices(): Promise<void> {
    try {
      const shared = await getSharedIfConfigured();
      const logger = shared?.logger ?? console;
      logger.debug?.(
        "updateAllTokenPrices",
        "start updating all token prices...",
      );

      const tokens = shared ? await shared.db.query.tokensTable.findMany() : [];
      if (tokens.length === 0) {
        logger.debug?.("updateAllTokenPrices", "no tokens to update");
        return;
      }

      logger.debug?.(
        "updateAllTokenPrices",
        `${tokens.length} tokens to update`,
      );

      const batchSize = 30;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        await this.updateTokenPricesBatch(batch, shared);

        if (i + batchSize < tokens.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      logger.debug?.("updateAllTokenPrices", "token prices updated");
    } catch (error) {
      console.error("updateAllTokenPrices: error updating token prices", error);
      throw error;
    }
  }

  private async updateTokenPricesBatch(
    tokens: TokenSelect[],
    shared: any,
  ): Promise<void> {
    try {
      const logger = shared?.logger ?? console;

      const tokenAddresses = tokens.map((token) => token.address);
      const addressesParam = tokenAddresses.join(",");

      const response = await fetch(
        `${this.jupiterApiUrl}?ids=${addressesParam}`,
      );

      if (!response.ok) {
        logger.error?.("updateTokenPricesBatch", "error fetching token prices", {
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(
          `Không thể lấy giá từ API Jupiter.: ${response.status} ${response.statusText}`,
        );
      }

      const priceData = (await response.json()) as JupiterPriceResponse;
      const now = new Date();

      const priceInserts: TokenPriceUpdate[] = [];
      const historyInserts: TokenPriceHistoryInsert[] = [];

      for (const token of tokens) {
        const tokenPrice = priceData.data[token.address];
        if (!tokenPrice || !tokenPrice.price) {
          logger.warn?.(
            "updateTokenPricesBatch",
            `${token.symbol} (${token.address}) price not found`,
          );
          continue;
        }

        historyInserts.push({
          tokenAddress: token.address,
          priceUsd: tokenPrice.price,
          timestamp: now,
          source: "jupiter",
        });

        priceInserts.push({
          tokenAddress: token.address,
          priceUsd: tokenPrice.price,
          lastUpdated: now,
          source: "jupiter",
        });

        logger.debug?.(
          "updateTokenPricesBatch",
          `${token.symbol} (${token.address}): ${tokenPrice.price} USD updated`,
        );
      }

      if (!shared) {
        logger.debug?.(
          "updateTokenPricesBatch",
          `DB not configured — skipping persistence, ${priceInserts.length} prices prepared`,
        );
        return;
      }

      const { tokenPricesTable, tokenPriceHistory } = shared as any;

      if (priceInserts.length > 0) {
        const bulkOps = priceInserts.map((p) => ({
          updateOne: {
            filter: { tokenAddress: p.tokenAddress },
            update: {
              $set: {
                priceUsd: p.priceUsd,
                lastUpdated: p.lastUpdated,
                source: p.source,
              },
            },
            upsert: true,
          },
        }));
        await tokenPricesTable.bulkWrite(bulkOps as any);
      }

      if (historyInserts.length > 0) {
        await tokenPriceHistory.insertMany(historyInserts as any);
      }

      logger.debug?.(
        "updateTokenPricesBatch",
        `${historyInserts.length} tokens prices updated`,
      );
    } catch (error) {
      const logger = (await getSharedIfConfigured())?.logger ?? console;
      logger.error?.(
        "updateTokenPricesBatch",
        "error updating token prices",
        error,
      );
      throw error;
    }
  }

  async getTokenPrice(tokenAddress: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.jupiterApiUrl}?ids=${tokenAddress}`,
      );

      if (!response.ok) {
        throw new Error(
          `Không thể lấy giá từ API Jupiter.: ${response.status} ${response.statusText}`,
        );
      }

      const priceData = (await response.json()) as JupiterPriceResponse;
      const tokenPrice = priceData.data[tokenAddress];

      return tokenPrice?.price ?? null;
    } catch (error) {
      const logger = (await getSharedIfConfigured())?.logger ?? console;
      logger.error?.(
        "getTokenPrice",
        `error fetching token price for ${tokenAddress}`,
        error,
      );
      return null;
    }
  }

  private shouldRefreshTokenPriceView(): boolean {
    const now = new Date();
    const isRefreshWindow =
      now.getHours() === 0 && now.getMinutes() <= 5;

    if (!isRefreshWindow) return false;

    if (this.lastRefreshDate) {
      const lastDay =
        this.lastRefreshDate.toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      if (lastDay === today) return false;
    }

    return true;
  }

  public async refreshMaterializedViewsIfNeeded(): Promise<void> {
    if (!this.shouldRefreshTokenPriceView()) return;

    const shared = await getSharedIfConfigured();
    const logger = shared?.logger ?? console;

    if (!shared) {
      logger.debug?.(
        "refreshMaterializedViewsIfNeeded",
        "no DB connection; skipping refresh",
      );
      return;
    }

    logger.debug?.(
      "refreshMaterializedViewsIfNeeded",
      "MongoDB: materialized views not applicable",
    );

    this.lastRefreshDate = new Date();
  }
}
