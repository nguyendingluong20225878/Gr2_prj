import { Types } from "mongoose";
import { connectToDatabase } from "../db/index.js";
import { tokenPricesTable } from "../db/schema/token_prices.js";
import { tokensTable, TokenSchema } from "../db/schema/tokens.js";
import { usersTable } from "../db/schema/users.js";
import { TokenPriceSchema } from "../db/schema/token_prices.js";
import { logger } from "./logger.js";

export async function setupInitialPortfolio(
  userId: string,
  options?: {
    customBalances?: Record<string, number>;
    specificSymbols?: string[];
  },
): Promise<void> {
  try {
    await connectToDatabase();

    /* ===============================
       1. QUERY TOKENS
    =============================== */

    const tokenQuery =
      options?.specificSymbols?.length
        ? { symbol: { $in: options.specificSymbols } }
        : {};

    const tokens = await tokensTable.find(tokenQuery).lean<TokenSchema[]>();

    if (!tokens.length) {
      logger.error(
        "setupInitialPortfolio",
        "Không tìm thấy token để setup portfolio",
      );
      return;
    }

    /* ===============================
       2. QUERY PRICES (ĐÚNG TYPE)
    =============================== */

    const tokenPrices = await tokenPricesTable
      .find({
        tokenAddress: { $in: tokens.map((t) => t.address) },
      })
      .select({ tokenAddress: 1, priceUsd: 1, _id: 0 })
      .lean<Pick<TokenPriceSchema, "tokenAddress" | "priceUsd">[]>();

    /* ===============================
       3. BUILD PRICE MAP
    =============================== */

    const priceMap = new Map<string, number>();
    for (const tp of tokenPrices) {
      const price = Number(tp.priceUsd);
      priceMap.set(tp.tokenAddress, Number.isFinite(price) ? price : 0);
    }

    /* ===============================
       4. DEFAULT BALANCES
    =============================== */

    const defaultUsdBalances: Record<string, number> = {
      SOL: 2000,
      JUP: 1000,
      USDC: 2000,
      WBTC: 2000,
    };

    /* ===============================
       5. CALCULATE BALANCES
    =============================== */

    const balancesToInsert = tokens
      .map((token) => {
        const usdAmount =
          options?.customBalances?.[token.symbol] ??
          defaultUsdBalances[token.symbol] ??
          0;

        const price = priceMap.get(token.address) ?? 0;
        const tokenAmount = price > 0 ? usdAmount / price : 0;

        return {
          tokenAddress: token.address,
          balance: tokenAmount.toString(),
          updatedAt: new Date(),
        };
      })
      .filter((b) => Number(b.balance) > 0);

    /* ===============================
       6. UPDATE USER
    =============================== */

    const normalizedUserId = Types.ObjectId.isValid(userId)
      ? new Types.ObjectId(userId)
      : userId;

    if (balancesToInsert.length) {
      await usersTable.updateOne(
        { _id: normalizedUserId },
        { $set: { balances: balancesToInsert } },
      );
    }

    logger.info(
      "setupInitialPortfolio",
      `Completed portfolio setup for user ${userId}`,
    );
  } catch (error) {
    logger.error(
      "setupInitialPortfolio",
      "Failed to setup initial portfolio",
      error,
    );
    throw error;
  }
}
