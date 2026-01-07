type TokenSelect = any; // token ít nhất address và symbol

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

// ==========================================
// DB Connection Helpers (Đã fix từ bước trước)
// ==========================================
let cachedShared: any = null;
async function getSharedIfConfigured() {
  if (cachedShared) return cachedShared;

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.warn(
      "token-price-fetcher: MongoDB not configured (MONGODB_URI missing); persistence will be skipped"
    );
    return null;
  }

  // Import shared module
  const shared = await import("../../../shared/src/index.js" as any);
  
  // FIX: Dùng hàm connect của shared để tránh conflict mongoose instance
  if (shared.connectToDatabase) {
    await shared.connectToDatabase();
  } else {
    const mongoose = await import("mongoose");
    await mongoose.connect(mongoUri);
  }
  
  // Lấy thêm tokensTable từ shared
  const { tokenPricesTable, tokenPriceHistory, tokensTable } = shared as any;

  cachedShared = {
    tokenPricesTable,
    tokenPriceHistory,
    tokensTable,
    logger: shared?.logger ?? console,
  };

  return cachedShared;
}

// ==========================================
// Service Logic
// ==========================================
export class TokenPriceService {
  private jupiterApiUrl: string;
  private lastRefreshDate: Date | null = null;

  constructor() {
    this.jupiterApiUrl =
      process.env.JUPITER_API_URL || "https://api.jup.ag/price/v2";
  }

  /**
   * Helper tạo Headers để vượt qua chặn Bot (401 Unauthorized)
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://jup.ag",
        "Referer": "https://jup.ag/",
        "Accept": "application/json"
    };

    // Nếu người dùng có set API Key trong .env
    if (process.env.JUPITER_API_KEY) {
        headers["x-api-key"] = process.env.JUPITER_API_KEY;
    }

    return headers;
  }

  async updateAllTokenPrices(): Promise<void> {
    try {
      const shared = await getSharedIfConfigured();
      const logger = shared?.logger ?? console;
      logger.debug?.(
        "updateAllTokenPrices",
        "start updating all token prices..."
      );

      // FIX: Dùng Mongoose find() thay vì Drizzle
      const tokens = shared ? await shared.tokensTable.find({}) : [];
      
      if (tokens.length === 0) {
        logger.debug?.("updateAllTokenPrices", "no tokens to update");
        return;
      }

      logger.debug?.(
        "updateAllTokenPrices",
        `${tokens.length} tokens to update`
      );

      const batchSize = 30; // Giảm batch size nếu cần
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        await this.updateTokenPricesBatch(batch, shared);

        if (i + batchSize < tokens.length) {
          // Delay nhẹ để tránh rate limit
          await new Promise((resolve) => setTimeout(resolve, 500));
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
    shared: any
  ): Promise<void> {
    try {
      const logger = shared?.logger ?? console;

      const tokenAddresses = tokens.map((token: any) => token.address);
      const addressesParam = tokenAddresses.join(",");

      // FIX: Thêm headers vào fetch
      const response = await fetch(
        `${this.jupiterApiUrl}?ids=${addressesParam}`,
        { headers: this.getHeaders() } 
      );

      if (!response.ok) {
        // Log chi tiết lỗi để debug
        logger.error?.(
          "updateTokenPricesBatch",
          "error fetching token prices",
          {
            status: response.status,
            statusText: response.statusText,
          }
        );
        throw new Error(
          `Không thể lấy giá từ API Jupiter.: ${response.status} ${response.statusText}`
        );
      }

      const priceData = (await response.json()) as JupiterPriceResponse;
      const now = new Date();

      const priceInserts: TokenPriceUpdate[] = [];
      const historyInserts: TokenPriceHistoryInsert[] = [];

      for (const token of tokens) {
        const tokenPrice = priceData.data[token.address];
        if (!tokenPrice || !tokenPrice.price) {
          // Token này không có giá trên Jupiter, bỏ qua
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
          `${token.symbol}: ${tokenPrice.price} USD`
        );
      }

      if (!shared) {
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

    } catch (error) {
      const logger = (await getSharedIfConfigured())?.logger ?? console;
      logger.error?.(
        "updateTokenPricesBatch",
        "error updating token prices",
        error
      );
      throw error;
    }
  }

  async getTokenPrice(tokenAddress: string): Promise<string | null> {
    try {
      // FIX: Thêm headers vào fetch
      const response = await fetch(
        `${this.jupiterApiUrl}?ids=${tokenAddress}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(
          `Không thể lấy giá từ API Jupiter.: ${response.status} ${response.statusText}`
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
        error
      );
      return null;
    }
  }

  private shouldRefreshTokenPriceView(): boolean {
    const now = new Date();
    const isRefreshWindow = now.getHours() === 0 && now.getMinutes() <= 5;

    if (!isRefreshWindow) return false;

    if (this.lastRefreshDate) {
      const lastDay = this.lastRefreshDate.toISOString().slice(0, 10);
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
      return;
    }

    this.lastRefreshDate = new Date();
  }
}