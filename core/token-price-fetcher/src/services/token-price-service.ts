// core/token-price-fetcher/src/services/token-price-service.ts

import { 
  connectToDatabase, 
  TokenPriceModel,      // Model giá hiện tại
  tokenPriceHistory,    // Model lịch sử giá (Import mới từ index)
  tokensTable,          // Model danh sách token (Import mới từ index)
  Logger
} from '@-ai/shared';

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

export class TokenPriceService {
  private jupiterApiUrl: string;
  private logger: Logger;

  constructor() {
    this.jupiterApiUrl = process.env.JUPITER_API_URL || "https://api.jup.ag/price/v2";
    this.logger = new Logger('TokenPriceService');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://jup.ag",
        "Referer": "https://jup.ag/",
        "Accept": "application/json"
    };
    if (process.env.JUPITER_API_KEY) {
        headers["x-api-key"] = process.env.JUPITER_API_KEY;
    }
    return headers;
  }

  async updateAllTokenPrices(): Promise<void> {
    try {
      this.logger.debug("start updating all token prices...");

      // 1. Kết nối DB
      await connectToDatabase();

      // 2. Lấy danh sách token
      // tokensTable là Mongoose Model nên dùng .find() trực tiếp
      const tokens = await tokensTable.find({});
      
      if (!tokens || tokens.length === 0) {
        this.logger.debug("no tokens to update");
        return;
      }

      this.logger.debug(`${tokens.length} tokens to update`);

      const batchSize = 30;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        await this.updateTokenPricesBatch(batch);

        if (i + batchSize < tokens.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      this.logger.debug("token prices updated");
    } catch (error) {
      this.logger.error("error updating token prices", error);
      throw error;
    }
  }

  private async updateTokenPricesBatch(tokens: any[]): Promise<void> {
    try {
      const tokenAddresses = tokens.map((token: any) => token.address);
      const addressesParam = tokenAddresses.join(",");

      const response = await fetch(
        `${this.jupiterApiUrl}?ids=${addressesParam}`,
        { headers: this.getHeaders() } 
      );

      if (!response.ok) {
        this.logger.error("error fetching token prices", {
            status: response.status,
            statusText: response.statusText,
        });
        throw new Error(`Jupiter API Error: ${response.status}`);
      }

      const priceData = (await response.json()) as JupiterPriceResponse;
      const now = new Date();
      
      const priceUpdates = [];
      const historyInserts = [];

      for (const token of tokens) {
        const tokenPrice = priceData.data[token.address];
        if (!tokenPrice || !tokenPrice.price) continue;

        // A. Cập nhật bảng giá hiện tại (TokenPriceModel)
        priceUpdates.push({
          updateOne: {
            filter: { tokenAddress: token.address },
            update: {
              $set: {
                priceUsd: tokenPrice.price,
                lastUpdated: now,
                source: "jupiter",
              },
            },
            upsert: true,
          },
        });

        // B. Chuẩn bị dữ liệu lịch sử (TokenPriceHistory)
        historyInserts.push({
          tokenAddress: token.address,
          priceUsd: tokenPrice.price,
          timestamp: now,
          source: "jupiter",
        });
        
        this.logger.debug(`${token.symbol}: ${tokenPrice.price} USD`);
      }

      // Thực thi Batch Update
      if (priceUpdates.length > 0) {
        await TokenPriceModel.bulkWrite(priceUpdates);
      }

      // Thực thi Insert History
      if (historyInserts.length > 0) {
        await tokenPriceHistory.insertMany(historyInserts);
      }
      
    } catch (error) {
      this.logger.error("error updating token prices batch", error);
      throw error; // Ném lỗi để cron job biết là fail
    }
  }

  async getTokenPrice(tokenAddress: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.jupiterApiUrl}?ids=${tokenAddress}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) return null;

      const priceData = (await response.json()) as JupiterPriceResponse;
      return priceData.data[tokenAddress]?.price ?? null;
    } catch (error) {
      this.logger.error(`error fetching token price for ${tokenAddress}`, error);
      return null;
    }
  }
}