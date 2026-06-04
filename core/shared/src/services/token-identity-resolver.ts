import type { FilterQuery } from "mongoose";
import { tokensTable } from "../db/schema/tokens.js";
import type { TokenSchema } from "../db/schema/tokens.js";

export type ResolveTokenInput = {
  chain: string;
  addressOrMint?: string | null;
  symbol?: string | null;
  coingeckoId?: string | null;
  tokenKey?: string | null;
};

export type ResolveTokenOptions = {
  allowPlaceholder?: boolean;
};

export type ResolvedToken = TokenSchema & {
  _id: unknown;
};

function clean(value?: string | null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

function uniq(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function canonicalKeyFor(chain: string, symbol?: string | null, fallback?: string | null) {
  const safeChain = chain.trim().toLowerCase();
  const safeSymbol = clean(symbol)?.toUpperCase();
  if (safeSymbol) return `${safeChain}:${safeSymbol}`;
  const safeFallback = clean(fallback);
  return safeFallback ? `${safeChain}:${safeFallback}` : null;
}

function buildPlaceholder(input: ResolveTokenInput) {
  const chain = clean(input.chain)?.toLowerCase();
  if (!chain) throw new Error("chain is required");

  const addressOrMint = clean(input.addressOrMint);
  const symbol = clean(input.symbol)?.toUpperCase();
  const coingeckoId = clean(input.coingeckoId);
  const tokenKey = clean(input.tokenKey);
  const canonicalKey = canonicalKeyFor(chain, symbol, coingeckoId ?? addressOrMint ?? tokenKey);

  if (!canonicalKey) {
    throw new Error("Cannot create placeholder token without an identifier");
  }

  const aliases = [
    addressOrMint ? { type: "mint", value: addressOrMint } : null,
    coingeckoId ? { type: "coingecko", value: coingeckoId } : null,
    tokenKey ? { type: "priceKey", value: tokenKey } : null,
    symbol ? { type: "symbol", value: symbol } : null,
  ].filter(Boolean);

  return {
    canonicalKey,
    chain,
    primaryAddress: addressOrMint ?? "unknown",
    address: addressOrMint ?? undefined,
    coingeckoId: coingeckoId ?? undefined,
    symbol: symbol ?? canonicalKey,
    name: symbol ?? canonicalKey,
    decimals: 18,
    type: "spl",
    iconUrl: "",
    aliases,
  };
}

export class TokenIdentityResolver {
  static async resolveToken(
    input: ResolveTokenInput,
    options: ResolveTokenOptions = {}
  ): Promise<ResolvedToken | null> {
    const chain = clean(input.chain)?.toLowerCase();
    if (!chain) throw new Error("chain is required");

    const addressOrMint = clean(input.addressOrMint);
    const symbol = clean(input.symbol)?.toUpperCase();
    const coingeckoId = clean(input.coingeckoId);
    const tokenKey = clean(input.tokenKey);
    const aliasValues = uniq([addressOrMint, symbol, coingeckoId, tokenKey]);

    if (aliasValues.length > 0) {
      const byAlias = await tokensTable
        .findOne({ "aliases.value": { $in: aliasValues } } as FilterQuery<TokenSchema>)
        .lean<ResolvedToken>();
      if (byAlias) return byAlias;
    }

    if (addressOrMint) {
      const byPrimaryAddress = await tokensTable
        .findOne({ primaryAddress: addressOrMint } as FilterQuery<TokenSchema>)
        .lean<ResolvedToken>();
      if (byPrimaryAddress) return byPrimaryAddress;
    }

    if (coingeckoId) {
      const byCoingeckoId = await tokensTable
        .findOne({ coingeckoId } as FilterQuery<TokenSchema>)
        .lean<ResolvedToken>();
      if (byCoingeckoId) return byCoingeckoId;
    }

    if (symbol) {
      const bySymbolAndChain = await tokensTable
        .findOne({ symbol, chain } as FilterQuery<TokenSchema>)
        .lean<ResolvedToken>();
      if (bySymbolAndChain) return bySymbolAndChain;
    }

    if (!options.allowPlaceholder) return null;

    return tokensTable.create(buildPlaceholder({ ...input, chain })) as unknown as ResolvedToken;
  }
}

export const resolveToken = TokenIdentityResolver.resolveToken.bind(TokenIdentityResolver);
