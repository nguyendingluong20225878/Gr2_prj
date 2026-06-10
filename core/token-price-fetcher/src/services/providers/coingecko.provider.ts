// src/services/providers/coingecko.provider.ts
import fetch from "node-fetch";

const BASE_URL = process.env.COINGECKO_BASE_URL ?? "https://api.coingecko.com/api/v3";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY ?? process.env.CG_API_KEY;
const COINGECKO_API_KEY_HEADER =
  process.env.COINGECKO_API_KEY_HEADER ??
  (BASE_URL.includes("pro-api") ? "x-cg-pro-api-key" : "x-cg-demo-api-key");

export class CoinGeckoError extends Error {
  status: number;
  retryAfterMs?: number;

  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = "CoinGeckoError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}

function buildHeaders() {
  return COINGECKO_API_KEY ? { [COINGECKO_API_KEY_HEADER]: COINGECKO_API_KEY } : undefined;
}

function coingeckoError(message: string, res: { status: number; statusText: string; headers: { get(name: string): string | null } }) {
  return new CoinGeckoError(
    `${message}: ${res.status} ${res.statusText}`,
    res.status,
    parseRetryAfterMs(res.headers.get("retry-after"))
  );
}

/**
 * Lấy top coin theo market cap
 */
export async function fetchTopCoinsByMarketCap(limit = 100) {
  const url =
    `${BASE_URL}/coins/markets` +
    `?vs_currency=usd` +
    `&order=market_cap_desc` +
    `&per_page=${limit}` +
    `&page=1`;

  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) {
    throw coingeckoError("CoinGecko error", res);
  }

  return res.json() as Promise<
    {
      id: string;
      symbol: string;
      name: string;
      image: string;
      current_price: number;
    }[]
  >;
}

/**
 * Lấy giá theo coingecko id
 */
export async function fetchPricesFromCoingecko(ids: string[]) {
  if (ids.length === 0) return {};

  const url =
    `${BASE_URL}/simple/price` +
    `?ids=${ids.join(",")}` +
    `&vs_currencies=usd`;

  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) {
    throw coingeckoError("CoinGecko error", res);
  }

  const data = await res.json();

  const prices: Record<string, number> = {};
  for (const id of ids) {
    if (data[id]?.usd !== undefined) {
      prices[id] = data[id].usd;
    }
  }

  return prices;
}

/**
 * Lấy lịch sử giá theo CoinGecko id trong khoảng thời gian Unix seconds.
 */
export async function fetchMarketChartRangeFromCoingecko(
  id: string,
  fromUnixSeconds: number,
  toUnixSeconds: number
) {
  const url =
    `${BASE_URL}/coins/${encodeURIComponent(id)}/market_chart/range` +
    `?vs_currency=usd` +
    `&from=${fromUnixSeconds}` +
    `&to=${toUnixSeconds}`;

  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) {
    throw coingeckoError(`CoinGecko market_chart/range error for ${id}`, res);
  }

  const data = await res.json() as {
    prices?: Array<[number, number]>;
  };

  return (data.prices ?? [])
    .map(([timestampMs, priceUsd]) => ({
      timestamp: new Date(timestampMs),
      priceUsd,
    }))
    .filter((point) => Number.isFinite(point.priceUsd) && point.priceUsd > 0);
}
