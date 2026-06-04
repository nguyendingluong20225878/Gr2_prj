// src/services/token-list-service.ts
import { tokensTable, Logger } from "@gr2/shared";
import { fetchTopCoinsByMarketCap } from "./providers/coingecko.provider.js";

const logger = new Logger("TokenListService");

export class TokenListService {
  static async importTopCoins(limit = 100) {
    logger.info(`Đang import top ${limit} coin...`);

    // 1. Lấy danh sách Top 100 (Không có platforms)
    const coins = await fetchTopCoinsByMarketCap(limit);

    // 2. Lấy TẤT CẢ thông tin contract address từ API CoinGecko List
    logger.info(`Đang tải dữ liệu Platform Addresses từ CoinGecko...`);
    let platformsMap = new Map();
    try {
      // Gọi trực tiếp API list của CoinGecko để lấy map platforms
      const response = await fetch("https://api.coingecko.com/api/v3/coins/list?include_platform=true");
      const allCoinsList = await response.json();
      
      // Đưa vào Map để tra cứu cực nhanh bằng ID (O(1))
      for (const item of allCoinsList) {
        platformsMap.set(item.id, item.platforms);
      }
    } catch (error) {
      logger.error("Lỗi khi tải Platform Addresses:", error);
    }

    // 3. Ghép nối dữ liệu
    const bulkOps = coins.map((c: any) => {
      // Lấy platforms từ Map thay vì từ response của 'coins'
      const platforms = platformsMap.get(c.id) || {};
      
      // Logic lấy Address: ưu tiên Solana, sau đó đến Ethereum
      const rawAddress = platforms.solana || platforms.ethereum || "";
      
      // Xác định loại: Nếu có address thì coi là SPL (Solana) hoặc mặc định là coin
      const tokenType: "coin" | "spl" = rawAddress ? "spl" : "coin";
      
      // Nếu là Native Coin (BTC, ETH, SOL) thì gán 'native' để không bị rỗng DB
      const finalAddress = rawAddress || "native";
      const symbol = c.symbol.toUpperCase();
      const chain = "solana";
      const aliases = [
        { type: finalAddress === "native" ? "native" : "address", value: finalAddress },
        { type: "coingecko", value: c.id },
        { type: "priceKey", value: `coingecko:${c.id}` },
        { type: "symbol", value: symbol },
      ];

      return {
        updateOne: {
          filter: { coingeckoId: c.id },
          update: {
            $set: {
              aliases,
              canonicalKey: `${chain}:${symbol}`,
              chain,
              coingeckoId: c.id,
              symbol,
              name: c.name,
              address: finalAddress, 
              primaryAddress: finalAddress,
              iconUrl: c.image,
              decimals: 18,
              type: tokenType, 
            },
          },
          upsert: true,
        },
      };
    });

    await tokensTable.bulkWrite(bulkOps as any);

    logger.info(`Đã import và cập nhật địa chỉ thành công cho ${bulkOps.length} coin!`);
  }
}
