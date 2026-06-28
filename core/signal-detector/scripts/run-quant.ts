import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { detectSignalWithFinBertQuant } from '../src/quant-engine.js';
import { resolveProposalTokenIdentity } from '../src/proposal-token-identity.js';

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

async function loadPersistedRegimeFromDb(db: any, options: {
  maxAgeHours: number;
}): Promise<{ regime: string; updatedAt: Date; confidence: number; sampleCount: number; reason: string } | null> {
  const row = await db.collection("job_state").findOne({ _id: "current-market-regime" });
  if (!row?.regime || !row.updatedAt) return null;

  const updatedAt = new Date(row.updatedAt);
  if (
    !Number.isFinite(updatedAt.getTime()) ||
    updatedAt.getTime() < Date.now() - options.maxAgeHours * 60 * 60 * 1000
  ) {
    return null;
  }

  return {
    regime: String(row.regime),
    updatedAt,
    confidence: Number(row.confidence ?? 0),
    sampleCount: Number(row.sampleCount ?? 0),
    reason: String(row.reason ?? ""),
  };
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

function envFlag(name: string): boolean {
  return ["1", "true", "yes", "on"].includes(String(process.env[name] ?? "").toLowerCase());
}

function literal<T>(value: T): { $literal: T } {
  return { $literal: value };
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
    const regimeMaxAgeHours = Number(process.env.ROLLING_METRICS_MAX_AGE_HOURS ?? 48);
    const { betaBySymbol, regime: rollingMetricsRegime } = await loadLatestDynamicBetaFromDb(db, {
      windowHours: Number(process.env.ROLLING_METRICS_WINDOW_HOURS ?? 24),
      maxAgeHours: regimeMaxAgeHours,
    });
    const persistedRegime = await loadPersistedRegimeFromDb(db, {
      maxAgeHours: regimeMaxAgeHours,
    });
    const regime = persistedRegime?.regime ?? rollingMetricsRegime;
    const regimeSource = persistedRegime ? "job_state" : "rolling_metrics";
    const regimeDetails = persistedRegime
      ? `, regimeConfidence=${persistedRegime.confidence.toFixed(3)}, regimeSamples=${persistedRegime.sampleCount}, regimeReason=${persistedRegime.reason}`
      : "";
    console.log(`📈 Dynamic beta loaded for ${Object.keys(betaBySymbol).length} tokens, regime=${regime}, regimeSource=${regimeSource}${regimeDetails}.`);

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
      console.log("Chi tiết tín hiệu đã qua ngưỡng:");
      for (const result of results as any[]) {
        const score = Number(result.quantScore);
        const thresholdDecision = result.metadata?.thresholdDecision ?? {};
        const sourceKeys = Array.from(new Set(
          (result.metadata?.sourceKeys ?? result.sources ?? [])
            .map((source: any) => typeof source === "string" ? source : source.sourceKey ?? source.label)
            .filter(Boolean)
        ));
        const requiredThreshold = Number(thresholdDecision.requiredSignalThreshold);
        const actionThreshold = Number(thresholdDecision.actionThreshold);

        console.log([
          "   - ",
          result.tokenSymbol ?? "UNKNOWN",
          " | score=", Number.isFinite(score) ? score.toFixed(3) : "n/a",
          " | type=", String(result.suggestionType ?? "hold").toUpperCase(),
          " | emitThreshold=", Number.isFinite(requiredThreshold) ? requiredThreshold.toFixed(3) : "n/a",
          " | actionThreshold=", Number.isFinite(actionThreshold) ? actionThreshold.toFixed(3) : "n/a",
          " | regime=", result.metadata?.marketRegime ?? regime,
          " | mode=", result.signalMode ?? result.metadata?.signalMode ?? "UNKNOWN",
          " | samples=", result.metadata?.sampleSize ?? 0,
          " | sources=", sourceKeys.length,
          sourceKeys.length ? " (" + sourceKeys.join(", ") + ")" : "",
        ].join(""));
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const detectedAt = inputTo;
      const bucketKey = signalBucketKey(detectedAt);
      const reopenProcessedSignals = envFlag("SIGNAL_REOPEN_PROCESSED");
      const bulkOps = results.map((res: any) => {
        const symbol = res.tokenSymbol as string || "UNKNOWN";
        const tokenInfo = knownTokens.find((t: any) => t.symbol === symbol);
        const finalAddress = resolveProposalTokenIdentity(tokenInfo, symbol);
        const signalMode = res.signalMode ?? res.metadata?.signalMode ?? "UNKNOWN_MODE";
        const signalKey = `${symbol}:${bucketKey}:${signalMode}`;
        const keepIfProcessed = (fieldName: string, resetValue: unknown) => (
          reopenProcessedSignals
            ? literal(resetValue)
            : { $cond: [{ $eq: ["$status", "PROCESSED"] }, `$${fieldName}`, resetValue] }
        );
        const metadata = {
          sampleSize: historicalData[symbol]?.length || 0,
          isNewToken: (historicalData[symbol]?.length || 0) < 3,
          volatilityFlag: res.volatilityFlag || 0, 
          uncertaintyEntropy: res.uncertaintyEntropy ?? res.volatilityFlag ?? 0,
          signalMode: res.signalMode,
          processedAt: new Date(),
          ...(res.metadata || {})
        };

        return {
          updateOne: {
            filter: { signalKey },
            update: [
              {
                $set: {
                  signalKey: literal(signalKey),
                  tokenSymbol: literal(symbol),
                  tokenAddress: literal(finalAddress),
                  quantScore: literal(res.quantScore || 0),
                  confidence: literal(res.confidence || 0),
                  suggestionType: literal(res.suggestionType || "hold"),
                  sentimentType: literal(res.sentimentType || "neutral"),
                  sources: literal(res.sources || []),
                  metadata: literal(metadata),
                  uncertaintyEntropy: literal(res.uncertaintyEntropy ?? res.volatilityFlag ?? 0),
                  realizedVolatility: literal(res.realizedVolatility ?? null),
                  signalMode: literal(res.signalMode ?? res.metadata?.signalMode ?? null),
                  status: keepIfProcessed("status", "RAW"),
                  layer3LockedAt: keepIfProcessed("layer3LockedAt", null),
                  layer3LockedBy: keepIfProcessed("layer3LockedBy", null),
                  layer3RetryCount: keepIfProcessed("layer3RetryCount", 0),
                  lastLayer3Error: keepIfProcessed("lastLayer3Error", null),
                  errorType: keepIfProcessed("errorType", null),
                  createdAt: { $ifNull: ["$createdAt", new Date()] },
                  detectedAt: { $ifNull: ["$detectedAt", detectedAt] },
                  updatedAt: literal(new Date())
                }
              }
            ],
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
