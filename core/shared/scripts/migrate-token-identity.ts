import { connectToDatabase, disconnectFromDatabase } from "../src/db/connection.js";
import { resolveToken, tokenPricesTable, tokensTable, usersTable } from "../src/index.js";

const DEFAULT_CHAIN = process.env.TOKEN_IDENTITY_DEFAULT_CHAIN ?? "solana";
const DRY_RUN = process.env.TOKEN_IDENTITY_DRY_RUN === "1";
const SOLANA_NATIVE_MINT = "So11111111111111111111111111111111111111112";

type Alias = {
  type: "mint" | "address" | "coingecko" | "priceKey" | "symbol" | "native";
  value: string;
};

function clean(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function addAlias(aliases: Alias[], type: Alias["type"], value: unknown) {
  const normalized = clean(value);
  if (!normalized) return;
  if (aliases.some((alias) => alias.type === type && alias.value === normalized)) return;
  aliases.push({ type, value: normalized });
}

function mergeAliases(existing: Alias[] | undefined, next: Alias[]) {
  const merged: Alias[] = [];
  for (const alias of [...(existing ?? []), ...next]) {
    addAlias(merged, alias.type, alias.value);
  }
  return merged;
}

function canonicalKey(chain: string, symbol: unknown, fallback: unknown) {
  const safeSymbol = clean(symbol)?.toUpperCase();
  if (safeSymbol) return `${chain}:${safeSymbol}`;
  return `${chain}:${clean(fallback) ?? "unknown"}`;
}

async function migrateTokens() {
  const tokens = await (tokensTable as any).find({}).lean();
  let updated = 0;

  for (const token of tokens) {
    const chain = clean(token.chain) ?? DEFAULT_CHAIN;
    const symbol = clean(token.symbol)?.toUpperCase();
    const address = clean(token.address);
    const coingeckoId = clean(token.coingeckoId);
    const aliases: Alias[] = [];

    if (address) {
      addAlias(aliases, address === "native" ? "native" : "address", address);
    }
    if (coingeckoId) {
      addAlias(aliases, "coingecko", coingeckoId);
      addAlias(aliases, "priceKey", `coingecko:${coingeckoId}`);
    }
    if (symbol) addAlias(aliases, "symbol", symbol);

    // Token registry migration is the only allowed place to know native mint aliases.
    if (chain === "solana" && symbol === "SOL") {
      addAlias(aliases, "mint", SOLANA_NATIVE_MINT);
    }

    const nextAliases = mergeAliases(token.aliases, aliases);
    const primaryAddress = clean(token.primaryAddress) ?? address ?? "unknown";
    const nextCanonicalKey = clean(token.canonicalKey) ?? canonicalKey(chain, symbol, coingeckoId ?? address);

    if (!DRY_RUN) {
      await tokensTable.updateOne(
        { _id: token._id },
        {
          $set: {
            aliases: nextAliases,
            canonicalKey: nextCanonicalKey,
            chain,
            primaryAddress,
          },
        }
      );
    }
    updated += 1;
  }

  return updated;
}

async function migrateTokenPrices() {
  const prices = await (tokenPricesTable as any)
    .find({
      $or: [
        { token: { $exists: false } },
        { token: null },
      ],
    })
    .lean();
  let updated = 0;

  for (const price of prices) {
    const token = await resolveToken({
      chain: DEFAULT_CHAIN,
      tokenKey: price.tokenKey,
      addressOrMint: price.tokenAddress,
    });
    if (!token?._id) continue;

    if (!DRY_RUN) {
      await tokenPricesTable.updateOne(
        { _id: price._id },
        { $set: { token: token._id } }
      );
    }
    updated += 1;
  }

  return updated;
}

async function migrateUserBalances() {
  const users = await (usersTable as any)
    .find({ balances: { $exists: true, $ne: [] } })
    .lean();
  let updatedUsers = 0;
  let updatedBalances = 0;

  for (const user of users) {
    let changed = false;
    const balances = [];

    for (const balance of user.balances ?? []) {
      if (balance.token) {
        balances.push(balance);
        continue;
      }

      const token = await resolveToken({
        chain: DEFAULT_CHAIN,
        addressOrMint: balance.tokenAddress,
      });

      if (token?._id) {
        balances.push({ ...balance, token: token._id });
        changed = true;
        updatedBalances += 1;
      } else {
        balances.push(balance);
      }
    }

    if (changed) {
      if (!DRY_RUN) {
        await usersTable.updateOne(
          { _id: user._id },
          { $set: { balances } }
        );
      }
      updatedUsers += 1;
    }
  }

  return { updatedUsers, updatedBalances };
}

async function main() {
  await connectToDatabase();
  const tokens = await migrateTokens();
  const tokenPrices = await migrateTokenPrices();
  const balances = await migrateUserBalances();

  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    tokensUpdated: tokens,
    tokenPricesLinked: tokenPrices,
    userBalancesLinked: balances.updatedBalances,
    usersUpdated: balances.updatedUsers,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });
