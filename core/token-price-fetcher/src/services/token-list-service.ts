// src/services/token-list-service.ts
import { tokensTable, Logger } from "@gr2/shared";
import type { AnyBulkWriteOperation } from "mongoose";
import { fetchTopCoinsByMarketCap } from "./providers/coingecko.provider.js";

const logger = new Logger("TokenListService");

export class TokenListService {
  static async importTopCoins(limit = 100) {
    logger.info(`Đang import top ${limit} coin theo market cap...`);

    const coins = await fetchTopCoinsByMarketCap(limit);

  const bulkOps = coins.map((c) => ({
  updateOne: {
    filter: { coingeckoId: c.id },
    update: {
      $set: {
        coingeckoId: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        iconUrl: c.image,
        decimals: 18,
        type: "coin",   // ⭐ phân biệt rõ
      },
    },
    upsert: true,
  },
}));

    await tokensTable.bulkWrite(bulkOps);

    logger.info(`Đã import ${bulkOps.length} coin`);
  }
}
