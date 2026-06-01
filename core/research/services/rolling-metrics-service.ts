import {
  connectToDatabase,
  rollingMetricsTable,
  tokenPriceHistory,
  tokensTable,
  type MarketRegime,
} from "../../shared/src/index.js";

export type RollingMetricResult = {
  tokenSymbol: string;
  tokenAddress: string | null;
  windowHours: number;
  asOf: Date;
  returnPct: number;
  returnVol: number;
  corrToBtc: number;
  betaToBtc: number;
  sampleCount: number;
  marketRegime: MarketRegime;
};

type PricePoint = {
  timestamp: Date;
  priceUsd: number;
};
//Token tham chiếu để tính toán
type TokenRef = {
  symbol: string;
  address?: string | null;
  coingeckoId?: string | null;
};

//Ép kdl về số thực 
function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

//TBC
function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

//Phương sai ~ Độ phân tán dữ liệu
function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  //việc sử dụng mẫu là n-1 thay vì n là chuẩn mực trong thống kê
  //để đảm bảo ước lượng phương sai không bị lệch, đặc biệt với kích thước mẫu nhỏ
}

//Hiệp phương sai ~ Mức độ mà hai biến cùng biến động
function covariance(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length < 2) return 0;
  const avgA = mean(a.slice(0, length));
  const avgB = mean(b.slice(0, length));
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    total += (a[index] - avgA) * (b[index] - avgB);
  }
  return total / (length - 1);
}

//Hệ số tương quan ~ chuẩn hóa hiệp phương sai thành 1 con số [-1,1]
function correlation(a: number[], b: number[]): number {
  const cov = covariance(a, b);
  const std = Math.sqrt(variance(a) * variance(b));
  return std > 0 ? cov / std : 0;
}

//Hệ số beta ~ đo lường độ nhạy của token với biến động của BTC, được chuẩn hóa để nằm trong khoảng [0,2] nhằm tránh các giá trị cực đoan
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function bucketStart(timestamp: Date, bucketMs: number): number {
  return Math.floor(timestamp.getTime() / bucketMs) * bucketMs;
}

function bucketPriceSeries(points: PricePoint[], bucketMs: number): Map<number, PricePoint> {
  const buckets = new Map<number, PricePoint>();
  for (const point of [...points].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
    const bucket = bucketStart(point.timestamp, bucketMs);
    const existing = buckets.get(bucket);
    if (!existing || point.timestamp.getTime() >= existing.timestamp.getTime()) {
      buckets.set(bucket, point);
    }
  }
  return buckets;
}

function returnsFromBucketSeries(series: Map<number, PricePoint>): number[] {
  const buckets = [...series.keys()].sort((a, b) => a - b);
  const out: number[] = [];
  for (let index = 1; index < buckets.length; index += 1) {
    const previous = series.get(buckets[index - 1])?.priceUsd ?? 0;
    const current = series.get(buckets[index])?.priceUsd ?? 0;
    if (previous > 0 && current > 0) out.push((current - previous) / previous);
  }
  return out;
}

function alignedBucketReturns(
  tokenSeries: Map<number, PricePoint>,
  btcSeries: Map<number, PricePoint>
) {
  const commonBuckets = [...tokenSeries.keys()]
    .filter((bucket) => btcSeries.has(bucket))
    .sort((a, b) => a - b);
  const token: number[] = [];
  const btc: number[] = [];

  for (let index = 1; index < commonBuckets.length; index += 1) {
    const previousBucket = commonBuckets[index - 1];
    const currentBucket = commonBuckets[index];
    const tokenPrevious = tokenSeries.get(previousBucket)?.priceUsd ?? 0;
    const tokenCurrent = tokenSeries.get(currentBucket)?.priceUsd ?? 0;
    const btcPrevious = btcSeries.get(previousBucket)?.priceUsd ?? 0;
    const btcCurrent = btcSeries.get(currentBucket)?.priceUsd ?? 0;
    if (tokenPrevious > 0 && tokenCurrent > 0 && btcPrevious > 0 && btcCurrent > 0) {
      token.push((tokenCurrent - tokenPrevious) / tokenPrevious);
      btc.push((btcCurrent - btcPrevious) / btcPrevious);
    }
  }

  return { token, btc };
}

//Phân loại regime
function classifyRegime(params: {
  btcReturn: number;
  btcVol: number;
  avgCorrToBtc: number;
  dispersion: number;
}): MarketRegime {
  if (params.btcVol >= 0.06 && params.avgCorrToBtc >= 0.65) return "stress";
  //nếu BTC biến động mạnh (Vol> 0.06) và altCoin chạy theo BTC cực sát (avg >0.65) thì thị trường đang trong trạng thái stress, nhà đầu tư có xu hướng bán tháo và tìm đến các tài sản an toàn hơn
  if (params.btcReturn > 0.015 && params.btcVol < 0.05 && params.avgCorrToBtc >= 0.35) {
    return "risk_on";
  }
  //nếu BTC tăng giá mạnh (return > 1.5%) với biến động thấp (Vol < 0.05) và altCoin có mức độ tương quan vừa phải với BTC (avgCorrToBtc >= 0.35), thì thị trường đang trong trạng thái risk-on, nhà đầu tư có xu hướng mua vào và tìm kiếm lợi nhuận từ các tài sản rủi ro hơn
  if (params.btcReturn < -0.015 || params.btcVol >= 0.05) return "defensive";
  //nếu BTC giảm giá mạnh (return < -1.5%) hoặc biến động cao (Vol >= 0.05), thì thị trường đang trong trạng thái defensive, nhà đầu tư có xu hướng thận trọng, giảm rủi ro và tìm đến các tài sản an toàn hơn
  if (params.dispersion >= 0.04 && params.avgCorrToBtc < 0.45) return "rotation";
  //nếu thị trường có độ phân tán cao (dispersion >= 0.04) và mức độ tương quan với BTC thấp (avgCorrToBtc < 0.45), thì thị trường đang trong trạng thái rotation, nhà đầu tư có xu hướng chuyển đổi giữa các loại tài sản để tìm kiếm cơ hội tốt nhất
  return "mixed";
}

function tokenKeys(token: TokenRef): string[] {
  return [
    token.address,
    token.coingeckoId,
    token.coingeckoId ? `coingecko:${token.coingeckoId}` : null,
  ].filter((key): key is string => Boolean(key));
}

//Hàm chính để tính toán các chỉ số rolling metrics cho tất cả token dựa trên dữ liệu giá trong khoảng thời gian xác định, sau đó phân loại thị trường vào một regime cụ thể dựa trên các chỉ số này và cuối cùng lưu kết quả vào cơ sở dữ liệu để sử dụng sau này.
export async function computeRollingMetrics(options: {
  asOf?: Date;
  windowHours?: number;
  bucketMinutes?: number;
  minSamples?: number;
  persist?: boolean;
} = {}): Promise<RollingMetricResult[]> {
  await connectToDatabase();

  const asOf = options.asOf ?? new Date();
  const windowHours = options.windowHours ?? 24;
  const bucketMs = (options.bucketMinutes ?? 15) * 60 * 1000;
  const minSamples = options.minSamples ?? 6;
  const from = new Date(asOf.getTime() - windowHours * 60 * 60 * 1000);

  const tokens = await tokensTable
    .find({ type: { $in: ["coin", "spl"] } }, { symbol: 1, address: 1, coingeckoId: 1 })
    .lean();
  const refs: TokenRef[] = (tokens as any[]).map((token) => ({
    symbol: String(token.symbol).toUpperCase(),
    address: token.address ?? null,
    coingeckoId: token.coingeckoId ?? null,
  }));

  const keysBySymbol = new Map<string, string[]>();
  const allKeys = new Set<string>();
  for (const token of refs) {
    const keys = tokenKeys(token);
    keysBySymbol.set(token.symbol, keys);
    keys.forEach((key) => allKeys.add(key));
  }

  const priceRows = await tokenPriceHistory
    .find({
      tokenAddress: { $in: [...allKeys] },
      timestamp: { $gte: from, $lte: asOf },
    })
    .sort({ timestamp: 1 })
    .lean();

  const pointsByKey = new Map<string, PricePoint[]>();
  for (const row of priceRows as any[]) {
    const priceUsd = toFiniteNumber(row.priceUsd);
    if (!priceUsd) continue;
    const key = String(row.tokenAddress);
    const points = pointsByKey.get(key) ?? [];
    points.push({ timestamp: new Date(row.timestamp), priceUsd });
    pointsByKey.set(key, points);
  }

  const bucketSeriesBySymbol = new Map<string, Map<number, PricePoint>>();
  const returnsBySymbol = new Map<string, number[]>();
  const firstLastReturnBySymbol = new Map<string, number>();
  for (const token of refs) {
    const points = (keysBySymbol.get(token.symbol) ?? [])
      .flatMap((key) => pointsByKey.get(key) ?? [])
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    if (points.length < 2) continue;
    const bucketSeries = bucketPriceSeries(points, bucketMs);
    bucketSeriesBySymbol.set(token.symbol, bucketSeries);
    returnsBySymbol.set(token.symbol, returnsFromBucketSeries(bucketSeries));
    const first = points[0].priceUsd;
    const last = points[points.length - 1].priceUsd;
    firstLastReturnBySymbol.set(token.symbol, first > 0 ? (last - first) / first : 0);
  }

  const btcSymbol = bucketSeriesBySymbol.has("BTC") ? "BTC" : "WBTC";
  const btcSeries = bucketSeriesBySymbol.get(btcSymbol) ?? new Map();
  const btcReturns = returnsBySymbol.get(btcSymbol) ?? [];
  const btcWindowReturn = firstLastReturnBySymbol.get("BTC") ?? 0;
  const btcVol = Math.sqrt(variance(btcReturns));
  const draft: RollingMetricResult[] = [];

  for (const token of refs) {
    const tokenReturns = returnsBySymbol.get(token.symbol) ?? [];
    const tokenSeries = bucketSeriesBySymbol.get(token.symbol);
    if (!tokenSeries || tokenReturns.length < minSamples || btcReturns.length < minSamples) continue;

    const aligned = alignedBucketReturns(tokenSeries, btcSeries);
    if (aligned.token.length < minSamples) continue;
    const corrToBtc = correlation(aligned.token, aligned.btc);
    const btcVar = variance(aligned.btc);
    const betaToBtc = btcVar > 0 ? clamp(covariance(aligned.token, aligned.btc) / btcVar, 0, 2) : 0.75;
    draft.push({
      tokenSymbol: token.symbol,
      tokenAddress: token.address ?? token.coingeckoId ?? null,
      windowHours,
      asOf,
      returnPct: firstLastReturnBySymbol.get(token.symbol) ?? 0,
      returnVol: Math.sqrt(variance(tokenReturns)),
      corrToBtc: clamp(corrToBtc, -1, 1),
      betaToBtc,
      sampleCount: aligned.token.length,
      marketRegime: "mixed",
    });
  }

  const avgCorrToBtc = mean(draft.filter((row) => row.tokenSymbol !== "BTC").map((row) => row.corrToBtc));
  const dispersion = Math.sqrt(variance(draft.map((row) => row.returnPct)));
  const marketRegime = classifyRegime({
    btcReturn: btcWindowReturn,
    btcVol,
    avgCorrToBtc,
    dispersion,
  });
  const results = draft.map((row) => ({ ...row, marketRegime }));

  if (options.persist ?? true) {
    await (rollingMetricsTable as any).bulkWrite(
      results.map((row) => ({
        updateOne: {
          filter: {
            tokenSymbol: row.tokenSymbol,
            windowHours: row.windowHours,
            asOf: row.asOf,
          },
          update: {
            $set: {
              ...row,
              metadata: { avgCorrToBtc, btcVol, btcWindowReturn, dispersion },
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      })) as any[]
    );
  }

  return results;
}

export async function loadLatestDynamicBeta(options: {
  windowHours?: number;
  maxAgeHours?: number;
} = {}): Promise<{ betaBySymbol: Record<string, number>; regime: MarketRegime | "mixed" }> {
  await connectToDatabase();
  const windowHours = options.windowHours ?? 24;
  const minAsOf = new Date(Date.now() - (options.maxAgeHours ?? windowHours * 2) * 60 * 60 * 1000);
  const rows = await rollingMetricsTable
    .find({ windowHours, asOf: { $gte: minAsOf } })
    .sort({ asOf: -1 })
    .lean();

  const betaBySymbol: Record<string, number> = {};
  let regime: MarketRegime | "mixed" = "mixed";
  for (const row of rows as any[]) {
    const symbol = String(row.tokenSymbol);
    if (!(symbol in betaBySymbol) && Number.isFinite(row.betaToBtc)) {
      betaBySymbol[symbol] = clamp(Number(row.betaToBtc), 0, 2);
    }
    if (regime === "mixed" && row.marketRegime) regime = row.marketRegime;
  }

  return { betaBySymbol, regime };
}
