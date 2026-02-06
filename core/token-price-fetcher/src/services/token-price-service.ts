import { tokensTable, tokenPricesTable, Logger } from "@gr2/shared";
import { fetchPricesFromCoingecko } from "./providers/coingecko.provider.js";

const logger = new Logger("TokenPriceService");

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
}
