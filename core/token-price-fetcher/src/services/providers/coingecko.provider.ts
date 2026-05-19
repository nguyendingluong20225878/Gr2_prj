// src/services/providers/coingecko.provider.ts
import fetch from "node-fetch";

const BASE_URL = "https://api.coingecko.com/api/v3";

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

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CoinGecko error: ${res.statusText}`);
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

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CoinGecko error: ${res.statusText}`);
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

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CoinGecko market_chart/range error for ${id}: ${res.status} ${res.statusText}`);
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
