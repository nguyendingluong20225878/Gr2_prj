import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { detectSignalWithFinBertQuant } from '../src/quant-engine.js';

dotenv.config();

async function loadLatestDynamicBetaFromDb(db: any, options: {
  windowHours: number;
  maxAgeHours: number;
}) {
  const minAsOf = new Date(Date.now() - options.maxAgeHours * 60 * 60 * 1000);
  const rows = await db.collection("rolling_metrics")
    .find({ windowHours: options.windowHours, asOf: { $gte: minAsOf } })
    .sort({ asOf: -1 })
    .toArray();

  const betaBySymbol: Record<string, number> = {};
  let regime = "mixed";
  for (const row of rows as any[]) {
    const symbol = String(row.tokenSymbol ?? "");
    const beta = Number(row.betaToBtc);
    if (symbol && !(symbol in betaBySymbol) && Number.isFinite(beta)) {
      betaBySymbol[symbol] = Math.min(Math.max(beta, 0), 2);
    }
    if (regime === "mixed" && row.marketRegime) regime = String(row.marketRegime);
  }

  return { betaBySymbol, regime };
}

async function loadQuantWatermark(db: any, fallbackFrom: Date): Promise<Date> {
  const state = await db.collection("job_state").findOne({ _id: "quant-input-watermark" });
  const watermark = state?.lastSuccessfulQuantInputTo
    ? new Date(state.lastSuccessfulQuantInputTo)
    : fallbackFrom;
  return Number.isFinite(watermark.getTime()) ? watermark : fallbackFrom;
}

async function saveQuantWatermark(db: any, inputTo: Date, summary: Record<string, unknown>) {
  await db.collection("job_state").updateOne(
    { _id: "quant-input-watermark" },
    {
      $set: {
        lastSuccessfulQuantInputTo: inputTo,
        lastRunSummary: summary,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
}

function signalBucketKey(date: Date): string {
  const mode = String(process.env.SIGNAL_KEY_BUCKET ?? "halfday").toLowerCase();
  if (mode === "hour") {
    const bucket = new Date(date);
    bucket.setUTCMinutes(0, 0, 0);
    return bucket.toISOString().slice(0, 13).replace(/[-T:]/g, "");
  }

  const day = date.toISOString().slice(0, 10).replace(/-/g, "");
  if (mode === "day" || mode === "daily") return day;

  const suffix = date.getUTCHours() < 12 ? "AM" : "PM";
  return `${day}-${suffix}`;
}

async function main(): Promise<number> {
  console.log("🚀 [NDL QUANT] Bắt đầu phiên làm việc...");
  let exitCode = 0;

  try {
    // 1. Kết nối DB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("📡 Đã kết nối MongoDB.");

    const db = mongoose.connection.db;
    if (!db) throw new Error("Không thể lấy instance Database!");

    // 🚀 [QUYẾT ĐỊNH]: Cố định bảng signals theo yêu cầu của bạn
    const targetCollection = 'signals';

    const lookbackMinutes = Number(process.env.QUANT_LOOKBACK_MINUTES ?? 24 * 60);
    const safeLookbackMinutes = Number.isFinite(lookbackMinutes) && lookbackMinutes > 0
      ? lookbackMinutes
      : 24 * 60;
    const fallbackInputFrom = new Date(Date.now() - safeLookbackMinutes * 60 * 1000);
    const inputTo = new Date();
    const inputFrom = await loadQuantWatermark(db, fallbackInputFrom);

    // 2. QUERY DỮ LIỆU ĐẦU VÀO
    const rawNews = await db.collection('news_articles').find({
      scrapedAt: { $gt: inputFrom, $lte: inputTo },
    }).toArray();
    const rawTweets = await db.collection('tweets').find({
      tweetTime: { $gt: inputFrom, $lte: inputTo },
    }).toArray();
    const knownTokensRaw = await db.collection('tokens').find({ type: { $in: ['coin', 'spl'] } }).toArray();
    const xAccounts = await db.collection('x_accounts').find({}, { projection: { _id: 1, followerCount: 1 } }).toArray();
    const followerLogs = xAccounts
      .map((account: any) => Math.log1p(Number(account.followerCount || 0)))
      .filter((value: number) => Number.isFinite(value) && value > 0)
      .sort((a: number, b: number) => a - b);
    const medianFollowerLog = followerLogs.length
      ? followerLogs[Math.floor(followerLogs.length / 2)]
      : 1;
    const authorWeightById = new Map(
      xAccounts.map((account: any) => {
        const raw = Math.log1p(Number(account.followerCount || 0)) / Math.max(medianFollowerLog, 1);
        const weight = Math.min(Math.max(raw || 1, 0.5), 3);
        return [String(account._id), weight] as const;
      })
    );

    const formattedNews = rawNews.map((n: any) => ({
      ...n,
      docType: 'news',
      publishedAt: n.publishedAt ?? n.scrapedAt ?? new Date()
    }));

    const formattedTweets = rawTweets.map((t: any) => ({
      docType: 'tweet',
      id: t._id?.toString() ?? t.url ?? '',
      text: t.content || t.text || '',
      author: t.authorId ?? '',
      authorWeight: authorWeightById.get(String(t.authorId ?? '')) ?? 1,
      time: t.tweetTime || t.createdAt || new Date(),
      ...t
    }));

    const knownTokens = knownTokensRaw.map((tk: any) => ({
      ...tk,
      address: tk.address ?? undefined
    }));

    console.log(`📥 Đã tải watermark window (${inputFrom.toISOString()} -> ${inputTo.toISOString()}): ${rawNews.length} tin tức, ${rawTweets.length} tweets.`);

    // 3. NẠP LỊCH SỬ TỪ BẢNG SIGNALS (Dùng tokenSymbol)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const pastSignals = await db.collection(targetCollection).find({
      createdAt: { $gte: sevenDaysAgo }
    }).project({
      tokenSymbol: 1,
      quantScore: 1,
      "metadata.scoreComponents.unifiedRaw": 1,
      createdAt: 1,
    }).toArray();

    const historicalData: Record<string, any[]> = {};
    pastSignals.forEach((sig: any) => {
      const sym = sig.tokenSymbol as string;
      if (!sym) return;

      const raw = Number(sig.metadata?.scoreComponents?.unifiedRaw ?? sig.quantScore);
      if (!Number.isFinite(raw)) return;

      if (!historicalData[sym]) historicalData[sym] = [];
      historicalData[sym].push({
        unifiedRaw: raw,
        timestamp: new Date(sig.createdAt).getTime()
      });
    });
    console.log(`📚 Đã nạp lịch sử cho ${Object.keys(historicalData).length} tokens từ bảng [${targetCollection}].`);

    // 4. CHẠY ENGINE
    const { betaBySymbol, regime } = await loadLatestDynamicBetaFromDb(db, {
      windowHours: Number(process.env.ROLLING_METRICS_WINDOW_HOURS ?? 24),
      maxAgeHours: Number(process.env.ROLLING_METRICS_MAX_AGE_HOURS ?? 48),
    });
    console.log(`📈 Dynamic beta loaded for ${Object.keys(betaBySymbol).length} tokens, regime=${regime}.`);

    const results = await detectSignalWithFinBertQuant({
      formattedNews,
      formattedTweets,
      knownTokens,
      historicalData,
      dynamicBetaBySymbol: betaBySymbol,
      marketRegime: regime
    });

    // 5. LƯU KẾT QUẢ VÀO BẢNG SIGNALS
    if (results.length > 0) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const detectedAt = inputTo;
      const bucketKey = signalBucketKey(detectedAt);
      const bulkOps = results.map((res: any) => {
        const symbol = res.tokenSymbol as string || "UNKNOWN";
        const tokenInfo = knownTokens.find((t: any) => t.symbol === symbol);
        const finalAddress = tokenInfo?.address || tokenInfo?._id?.toString() || "unknown";
        const signalMode = res.signalMode ?? res.metadata?.signalMode ?? "UNKNOWN_MODE";
        const signalKey = `${symbol}:${bucketKey}:${signalMode}`;

        return {
          updateOne: {
            filter: { signalKey },
            update: {
              $set: {
                signalKey,
                tokenSymbol: symbol,
                tokenAddress: finalAddress,
                quantScore: res.quantScore || 0,
                confidence: res.confidence || 0,
                suggestionType: res.suggestionType || 'hold',
                sentimentType: res.sentimentType || 'neutral',
                sources: res.sources || [],
                metadata: {
                  sampleSize: historicalData[symbol]?.length || 0,
                  isNewToken: (historicalData[symbol]?.length || 0) < 3,
                  volatilityFlag: res.volatilityFlag || 0, 
                  uncertaintyEntropy: res.uncertaintyEntropy ?? res.volatilityFlag ?? 0,
                  signalMode: res.signalMode,
                  processedAt: new Date(),
                  ...(res.metadata || {})
                },
                uncertaintyEntropy: res.uncertaintyEntropy ?? res.volatilityFlag ?? 0,
                realizedVolatility: res.realizedVolatility ?? null,
                signalMode: res.signalMode ?? res.metadata?.signalMode ?? null,
                updatedAt: new Date()
              },
              $setOnInsert: {
                createdAt: new Date(),
                detectedAt,
                status: "RAW"
              }
            },
            upsert: true
          }
        };
      });

      // THỰC THI VÀ LOG CHI TIẾT ĐỂ KIỂM CHỨNG
      console.log(`⏳ Đang thực hiện BulkWrite ${bulkOps.length} lệnh vào bảng [${targetCollection}]...`);
      const writeResult = await db.collection(targetCollection).bulkWrite(bulkOps);
      
      console.log("--------------------------------------------------");
      console.log(`✅ KẾT QUẢ GHI DATABASE THỰC TẾ:`);
      console.log(`   - Số bản ghi mới (Inserted): ${writeResult.upsertedCount}`);
      console.log(`   - Số bản ghi cập nhật (Modified): ${writeResult.modifiedCount}`);
      console.log(`   - Tổng số bản ghi khớp filter: ${writeResult.matchedCount}`);
      console.log("--------------------------------------------------");

      if (writeResult.upsertedCount > 0 || writeResult.modifiedCount > 0) {
        console.log("🎉 THÀNH CÔNG: Dữ liệu đã được ghi nhận xuống đĩa.");
      }

    } else {
      console.log("💡 Không có tín hiệu nào đủ mạnh để tạo ra.");
    }

    await saveQuantWatermark(db, inputTo, {
      inputFrom,
      inputTo,
      rawNews: rawNews.length,
      rawTweets: rawTweets.length,
      signals: results.length,
    });
    console.log(`✅ Đã cập nhật quant watermark: ${inputTo.toISOString()}`);

  } catch (error) {
    console.error("❌ Lỗi thực thi hệ thống Quant:", error);
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("🏁 Đã ngắt kết nối DB. Hoàn tất.");
  }

  return exitCode;
}

main()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error("❌ Lỗi không mong muốn khi kết thúc Quant:", error);
    process.exit(1);
  });
