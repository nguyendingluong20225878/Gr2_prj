// Dịch vụ này tính toán trọng số động cho các nguồn tín hiệu khác nhau dựa trên hiệu suất lịch sử của chúng trong việc dự đoán lợi nhuận tương lai của các token.
import {
  connectToDatabase,
  newsArticlesTable,
  signalsTable,
  sourceWeightsTable,
  tokenPriceHistory,
  tokensTable,
} from "../../shared/src/index.js";

type IcSample = {
  siteHost: string;
  sourceType: "news" | "twitter";
  sourceKey: string;
  displayName: string;
  signalScore: number;
  forwardReturn: number;
};
// Thuật toán này sẽ xem xét: "Khi một nguồn tin (trang báo A, B, C) đưa tin về một token và tạo ra tín hiệu (Signal),
// thì sau X giờ tiếp theo, giá của token đó có thực sự biến động đúng như tín hiệu dự báo hay không?". Nếu dự báo đúng
// nhiều lần, nguồn tin đó sẽ được tăng trọng số (uy tín hơn), ngược lại sẽ bị giảm trọng số.

//Giới hạn giá trị trong khoảng min-max
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

//Công thức toán học tính Hệ số tương quan Pearson
//Tinh hệ số tưng quan Pearson giữa 2 mảng điểm (điểm tín hiệu và điểm lợi nhuận tương lai)
//Giá trị thuộc [-1,1], r ~ 1 : tín hiệu và giá biến động cùng chiều -> tín hiệu tăng -> giá tăng
//r ~ -1 : tín hiệu và giá biến động ngược chiều -> tín hiệu tăng -> giá giảm
//r ~ 0 : tín hiệu và giá biến động không liên quan -> tín hiệu tăng -> giá có thể tăng hoặc giảm
function pearson(a: number[], b: number[]): number {
  //a : signalScore, b: forwardReturn
  const length = Math.min(a.length, b.length);//tính phần giao nhau
  if (length < 3) return 0;//tối thiểu 3 mẫu
  const left = a.slice(0, length);
  const right = b.slice(0, length);
  const avgA = left.reduce((sum, value) => sum + value, 0) / length;//TBC, reduce cộng dồn tát cả xong chia số ptu lenght
  const avgB = right.reduce((sum, value) => sum + value, 0) / length;
  let cov = 0;//hiệp phương sai giữa a và b
  let varA = 0;//phương sai của a
  let varB = 0;//phương sai của b
  for (let index = 0; index < length; index += 1) {
    const da = left[index] - avgA;//giá trị thứ index - tb (ai-avgA)
    const db = right[index] - avgB;
    cov += da * db;//cộng dồn tích của (ai-avgA) * (bi-avgB)
    //nếu da và db cùng dấu (cùng trên hoặc cùng dưới tb) thì tích da*db dương -> tăng cov -> tăng r và ngược lại
    varA += da ** 2;//triệt tiêu dấu -,
    varB += db ** 2;
  }
  const denom = Math.sqrt(varA * varB);//mẫu số là tích căn của phương sai a và b
  return denom > 0 ? cov / denom : 0;
}

//Trích xuất tên miền từ url
function hostFromUrl(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
    //https://www.coindesk.com/page1 --> coindesk.com
  } catch {
    return value || "unknown_source";
  }
}

function namespacedSourceKey(sourceType: "news" | "twitter", key: string): string {
  return `${sourceType}:${key}`;
}

function resolveSourceIdentity(source: any, articleHostByUrl: Map<string, string>): {
  siteHost: string;
  sourceType: "news" | "twitter";
  sourceKey: string;
  displayName: string;
} | null {
  const label = String(source.label ?? "");
  const rawSourceKey = String(source.sourceKey || "");

  if (label === "News Article") {
    const host = articleHostByUrl.get(String(source.url)) ?? hostFromUrl(String(source.url));
    if (!host || host === "unknown_source") return null;
    return {
      siteHost: namespacedSourceKey("news", host),
      sourceType: "news",
      sourceKey: host,
      displayName: host,
    };
  }

  if (label === "X (Twitter)") {
    const authorId = rawSourceKey || String(source.author || "");
    if (!authorId || authorId === "unknown_author" || authorId === "unknown_source") return null;
    return {
      siteHost: namespacedSourceKey("twitter", authorId),
      sourceType: "twitter",
      sourceKey: authorId,
      displayName: `X:${authorId}`,
    };
  }

  return null;
}

//Tìm giá của token tại thời điểm gần nhất
function nearestPrice(points: Array<{ timestamp: Date; priceUsd: number }>, at: Date, maxDistanceMs: number) {
  let best: { timestamp: Date; priceUsd: number } | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const currentDistance = Math.abs(point.timestamp.getTime() - at.getTime());
    if (currentDistance < distance) {
      best = point;
      distance = currentDistance;
    }
  }
  return best && distance <= maxDistanceMs ? best : null;
}

//Truy vấn danh sách token trong DB và tạo map từ symbol sang các key có thể dùng để tra cứu giá (địa chỉ, coingeckoId, v.v.)
async function tokenKeyMap() {
  const tokens = await tokensTable
    .find({}, { symbol: 1, address: 1, coingeckoId: 1 })
    .lean();
  const bySymbol = new Map<string, string[]>();
  const allKeys = new Set<string>();
  for (const token of tokens as any[]) {
    const symbol = String(token.symbol).toUpperCase();
    const keys = [
      token.address,
      token.coingeckoId,
      token.coingeckoId ? `coingecko:${token.coingeckoId}` : null,
    ].filter((key): key is string => Boolean(key));
    bySymbol.set(symbol, keys);
    keys.forEach((key) => allKeys.add(key));
  }
  return { bySymbol, allKeys: [...allKeys] };
}


//Main Function: Cập nhật trọng số động cho các nguồn tín hiệu 
export async function updateRollingSourceWeights(options: {
  windowDays?: number;
  horizonHours?: number;
  minSamples?: number;
  sparseMaxDistanceMs?: number;
  resetStale?: boolean;
} = {}) {
  await connectToDatabase();

  const jobStartedAt = new Date();
  const windowDays = options.windowDays ?? 60;
  const horizonHours = options.horizonHours ?? 24;
  const minSamples = options.minSamples ?? 5;
  const sparseMaxDistanceMs = options.sparseMaxDistanceMs ?? 6 * 60 * 60 * 1000;
  const resetStale = options.resetStale ?? true;
  const from = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const to = new Date(Date.now() - horizonHours * 60 * 60 * 1000);

  const { bySymbol, allKeys } = await tokenKeyMap();
  const signals = await signalsTable
    .find({ detectedAt: { $gte: from, $lte: to } })
    .sort({ detectedAt: 1 })
    .lean();
  const symbolsInWindow = new Set(
    (signals as any[])
      .map((signal) => String(signal.tokenSymbol ?? "").toUpperCase())
      .filter(Boolean)
  );
  const priceKeysInWindow = new Set<string>();
  for (const symbol of symbolsInWindow) {
    for (const key of bySymbol.get(symbol) ?? []) priceKeysInWindow.add(key);
  }
  const priceKeys = priceKeysInWindow.size > 0 ? [...priceKeysInWindow] : allKeys;

  //TRuy vấn đồng thời dữ liệu
  const [priceRows, articles] = await Promise.all([
    tokenPriceHistory
      .find({
        tokenAddress: { $in: priceKeys },
        timestamp: {
          $gte: new Date(from.getTime() - sparseMaxDistanceMs),
          $lte: new Date(Date.now() + sparseMaxDistanceMs),
        },
      })
      .sort({ timestamp: 1 })
      .lean(),
    newsArticlesTable
      .find({ scrapedAt: { $gte: from } }, { articleUrl: 1, siteUrl: 1 })
      .lean(),
  ]);

  const articleHostByUrl = new Map(
    (articles as any[]).map((article) => [
      String(article.articleUrl),
      hostFromUrl(String(article.siteUrl || article.articleUrl)),
    ])
  );
  const pricesByKey = new Map<string, Array<{ timestamp: Date; priceUsd: number }>>();
  for (const row of priceRows as any[]) {
    const price = Number(row.priceUsd);
    if (!Number.isFinite(price) || price <= 0) continue;
    const key = String(row.tokenAddress);
    const points = pricesByKey.get(key) ?? [];
    points.push({ timestamp: new Date(row.timestamp), priceUsd: price });
    pricesByKey.set(key, points);
  }

  const samples: IcSample[] = [];
  for (const signal of signals as any[]) {
    const symbol = String(signal.tokenSymbol ?? "").toUpperCase();
    const detectedAt = new Date(signal.detectedAt ?? signal.createdAt);
    if (!symbol || !Number.isFinite(detectedAt.getTime())) continue;

    const keys = bySymbol.get(symbol) ?? [String(signal.tokenAddress ?? "")];
    const points = keys.flatMap((key) => pricesByKey.get(key) ?? []);
    const entry = nearestPrice(points, detectedAt, sparseMaxDistanceMs);
    const exit = nearestPrice(
      points,
      new Date(detectedAt.getTime() + horizonHours * 60 * 60 * 1000),
      sparseMaxDistanceMs
    );
    if (!entry || !exit || entry.priceUsd <= 0) continue;

    //Lợi nhuận thực tế
    const forwardReturn = (exit.priceUsd - entry.priceUsd) / entry.priceUsd;
    const signalScore = Number(signal.quantScore ?? signal.directionScore ?? 0);
    if (!Number.isFinite(signalScore)) continue;

    const evidenceSources = Array.isArray(signal.metadata?.evidenceSources)
      ? signal.metadata.evidenceSources
      : signal.sources ?? [];
    for (const source of evidenceSources) {
      const identity = resolveSourceIdentity(source, articleHostByUrl);
      if (!identity) continue;
      samples.push({ ...identity, signalScore, forwardReturn });
    }
  }
  
  //gom nhóm theo nguồn tin 
  const grouped = new Map<string, IcSample[]>();//ICSample gồm source key, signalScore và forwardReturn sẽ gom nhóm theo nguồn
  for (const sample of samples) {
    const group = grouped.get(sample.siteHost) ?? [];
    group.push(sample);
    grouped.set(sample.siteHost, group);
  }

  const updates = [...grouped.entries()].map(([siteHost, group]) => {
    //Tính toán trọng số mới
    const ic = pearson(
      group.map((sample) => sample.signalScore),
      group.map((sample) => sample.forwardReturn)
    );
    const siteWeight = group.length >= minSamples ? clamp(1 + ic, 0.25, 2) : 1;
    //ic [-1,1] , đủ bài vt thì weight = 1+ IC=> sau đó dùng clamp để ép về ngưỡng an toàn (0,25-2)
    return {
      siteHost,
      sourceType: group[0].sourceType,
      sourceKey: group[0].sourceKey,
      displayName: group[0].displayName,
      horizonHours,
      windowDays,
      sampleCount: group.length,
      ic,
      siteWeight,
      updatedAt: new Date(),
    };
  });

  if (updates.length > 0) {
    //Update vào DB
    await sourceWeightsTable.bulkWrite(
      updates.map((row) => ({
        updateOne: {
          filter: { siteHost: row.siteHost },
          update: { $set: row },
          upsert: true,
        },
      }))
    );
  }
  if (resetStale) {
    const activeSourceKeys = updates.map((row) => row.siteHost);
    await sourceWeightsTable.updateMany(
      {
        siteHost: { $nin: activeSourceKeys },
        sourceKey: { $exists: true, $ne: null },
        updatedAt: { $lt: jobStartedAt },
      },
      {
        $set: {
          siteWeight: 1,
          ic: 0,
          sampleCount: 0,
          updatedAt: new Date(),
        },
      }
    );
  }

  return {
    windowDays,
    horizonHours,
    samples: samples.length,
    sourcesUpdated: updates.length,
    staleReset: resetStale,
    updates,
  };
}
