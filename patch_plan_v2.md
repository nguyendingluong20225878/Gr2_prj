## Issue 1
- Mô tả:
  - `core/run/src/index.ts/start` hiện chạy X scraper mặc định khi `RUN_X_SCRAPER !== "false"`.
  - Nếu thiếu `X_EMAIL/X_PASSWORD/X_USERNAME`, `core/x-scaper/scripts/run-scraper.ts` exit `1`, `execSync` throw và toàn bộ pipeline bỏ qua quant + Layer3.
  - Đây là regression vì X scraper không được làm crash pipeline chính.
- Giải pháp:
  - Chỉ chạy X scraper khi có đủ credential hoặc khi ép chạy bằng `RUN_X_SCRAPER=true`.
  - Wrap riêng bước X scraper bằng `try/catch`.
  - Nếu X scraper lỗi, log warning/error rồi tiếp tục bước quant và Layer3.
- Tại sao chọn cách này:
  - Minimal change trong `core/run/src/index.ts`, không sửa script scraper.
  - Giữ backward compatibility: production có credential vẫn chạy như hiện tại; môi trường thiếu credential tự skip.
  - X ingestion fail không chặn signal detector và Layer3.
- Code fix:
```ts
const hasXCredentials = Boolean(
  process.env.X_EMAIL &&
  process.env.X_PASSWORD &&
  process.env.X_USERNAME
);
const shouldRunXScraper =
  process.env.RUN_X_SCRAPER === "true" ||
  (process.env.RUN_X_SCRAPER !== "false" && hasXCredentials);

if (shouldRunXScraper) {
  try {
    logger.info("Bước 1: Cào dữ liệu từ X...");
    const scraperPath = path.resolve(
      __dirname,
      "../../x-scaper/scripts/run-scraper.ts"
    );

    execSync(`npx tsx ${scraperPath}`, {
      stdio: "inherit",
      env: process.env,
    });

    logger.info("Bước 1 hoàn thành: Cào dữ liệu từ X.");
  } catch (error) {
    logger.error("Bước 1 lỗi: X scraper thất bại, tiếp tục chạy quant/Layer3.", error);
  }
} else {
  logger.warn("Bước 1 bỏ qua: X scraper chưa bật hoặc thiếu credential.");
}
```

## Issue 2
- Mô tả:
  - `core/signal-detector/scripts/run-quant.ts/main` đã không reset `status: "RAW"` trên update.
  - Nhưng filter upsert vẫn là `tokenSymbol + createdAt >= startOfDay`.
  - Khi signal trong ngày đã `PROCESSED`, quant mới vẫn overwrite `quantScore/sources/metadata`, trong khi proposal cũ không được regenerate.
  - Kết quả: signal và proposal không còn consistent.
- Giải pháp:
  - Không update document đã `PROCESSED`.
  - Chỉ match signal trong ngày nếu status không phải `PROCESSED`.
  - Nếu chỉ còn signal đã `PROCESSED`, upsert sẽ insert signal mới với `status: "RAW"` và `detectedAt` mới.
- Tại sao chọn cách này:
  - Minimal change: chỉ đổi filter upsert.
  - Không cần thêm event id hoặc migration schema.
  - Giữ proposal cũ gắn với signal cũ, đồng thời cho phép intraday signal mới được Layer3 xử lý riêng.
- Code fix:
```ts
updateOne: {
  filter: {
    tokenSymbol: symbol,
    createdAt: { $gte: startOfDay },
    status: { $ne: "PROCESSED" },
  },
  update: {
    $set: {
      tokenSymbol: symbol,
      tokenAddress: finalAddress,
      quantScore: res.quantScore || 0,
      confidence: res.confidence || 0,
      suggestionType: res.suggestionType || "hold",
      sentimentType: res.sentimentType || "neutral",
      sources: res.sources || [],
      metadata: {
        sampleSize: historicalData[symbol]?.length || 0,
        isNewToken: (historicalData[symbol]?.length || 0) < 3,
        volatilityFlag: res.volatilityFlag || 0,
        uncertaintyEntropy: res.uncertaintyEntropy ?? res.volatilityFlag ?? 0,
        signalMode: res.signalMode,
        processedAt: new Date(),
        ...(res.metadata || {}),
      },
      uncertaintyEntropy: res.uncertaintyEntropy ?? res.volatilityFlag ?? 0,
      realizedVolatility: res.realizedVolatility ?? null,
      signalMode: res.signalMode ?? res.metadata?.signalMode ?? null,
      updatedAt: new Date(),
    },
    $setOnInsert: {
      createdAt: new Date(),
      detectedAt: new Date(),
      status: "RAW",
    },
  },
  upsert: true,
}
```

## Issue 3
- Mô tả:
  - `core/run/src/index.ts/acquirePipelineLock` dùng `LOCK_TTL_MS = 10 phút`.
  - Nếu X scraping + quant + Layer3 chạy lâu hơn TTL, process khác có thể coi lock là stale và chạy song song.
  - Điều này phá mục tiêu distributed lock chống cron overlap.
- Giải pháp:
  - Giữ TTL hiện tại để không thay đổi behavior stale recovery.
  - Thêm `refreshPipelineLock(owner)` để heartbeat `lockedAt` khi pipeline còn sống.
  - Trong lúc pipeline chạy, set interval refresh mỗi `LOCK_TTL_MS / 3`.
  - Clear interval trong `finally` trước khi release lock.
- Tại sao chọn cách này:
  - Minimal change, không đổi collection/schema lock.
  - Backward-compatible với document lock hiện tại.
  - Vẫn recover được stale lock nếu process chết, vì heartbeat dừng.
- Code fix:
```ts
async function refreshPipelineLock(owner: string) {
  const db = mongoose.connection.db;
  if (!db) return;
  await db.collection<JobLockDocument>("job_locks").updateOne(
    { _id: LOCK_ID, owner, releasedAt: null },
    {
      $set: {
        lockedAt: new Date(),
        ttlMs: LOCK_TTL_MS,
      },
    }
  );
}
```

```ts
let lockHeartbeat: NodeJS.Timeout | null = null;

try {
  lockHeartbeat = setInterval(() => {
    refreshPipelineLock(lockOwner).catch((error) => {
      logger.error("Không thể refresh pipeline lock:", error);
    });
  }, Math.max(30_000, Math.floor(LOCK_TTL_MS / 3)));

  logger.info("=== BẮT ĐẦU PIPELINE TỰ ĐỘNG ===");
  // giữ nguyên các bước pipeline hiện tại
} catch (error) {
  logger.error("Lỗi trong pipeline:", error);
} finally {
  if (lockHeartbeat) clearInterval(lockHeartbeat);
  await releasePipelineLock(lockOwner);
  isRunning = false;
}
```

## Issue 4
- Mô tả:
  - `core/signal-detector/src/alpha-analyzer.ts/evaluateAlphaAndCross` đã tính `historyValues` finite.
  - Nhưng các nhánh beta/cross/cold-start vẫn dùng `history.length`.
  - Nếu có 3 history documents nhưng chỉ 2 giá trị hợp lệ, token bị phân loại `NORMALIZED_ALPHA` dù timeZ đang xử lý như cold-start.
- Giải pháp:
  - Tạo helper local lấy finite history count.
  - Dùng `historyValues.length` nhất quán cho:
    - beta neutralization
    - validAlphas cross-section
    - final score branch
    - `isNewToken`
    - `sampleSizePenalty`
    - metadata `sampleSize`
- Tại sao chọn cách này:
  - Minimal change trong một function.
  - Không đổi công thức khi dữ liệu lịch sử sạch.
  - Backward-compatible với history cũ có record bẩn.
- Code fix:
```ts
const finiteHistoryValuesBySymbol = new Map<string, number[]>();

for (const [symbol, state] of tokenStates.entries()) {
  const historyValues = (historicalData[symbol] || [])
    .map(h => Number(h.unifiedRaw))
    .filter(value => Number.isFinite(value));
  finiteHistoryValuesBySymbol.set(symbol, historyValues);

  if (historyValues.length < 3) {
    state.timeZ = state.unifiedRaw;
  } else {
    const ema7 = historyValues.slice(1).reduce(
      (ema, value) => calcEMA(value, ema, 7),
      historyValues[0]
    );
    const mad7 = calcMAD(historyValues);
    const safeMad = Number.isFinite(mad7) ? Math.max(mad7 * 1.4826, 0.01) : 0.01;
    state.timeZ = (state.unifiedRaw - ema7) / safeMad;
  }

  if (symbol === "BTC") btcTimeZ = state.timeZ;
}
```

```ts
for (const [symbol, state] of tokenStates.entries()) {
  const historyCount = finiteHistoryValuesBySymbol.get(symbol)?.length ?? 0;

  if (historyCount < 3) {
    state.pureAlphaZ = state.timeZ;
  } else {
    state.pureAlphaZ = symbol === "BTC"
      ? state.timeZ
      : state.timeZ! - (hyperParams.betaToBtc * btcTimeZ);
  }
}

const validAlphas = Array.from(tokenStates.values())
  .filter(s => s.symbol !== "BTC" && (finiteHistoryValuesBySymbol.get(s.symbol)?.length ?? 0) >= 3)
  .map(s => s.pureAlphaZ!)
  .filter(value => Number.isFinite(value));
```

```ts
for (const [symbol, state] of tokenStates.entries()) {
  const historyCount = finiteHistoryValuesBySymbol.get(symbol)?.length ?? 0;

  if (historyCount < 3 || symbol === "BTC") {
    state.crossZ = 0;
    state.finalScore = state.pureAlphaZ;
  } else if (validAlphas.length >= 3) {
    state.crossZ = (state.pureAlphaZ! - crossMean) / safeCrossStd;
    state.finalScore =
      (hyperParams.alphaBlend * state.pureAlphaZ!) +
      ((1 - hyperParams.alphaBlend) * state.crossZ);
  } else {
    state.crossZ = 0;
    state.finalScore = state.pureAlphaZ;
  }

  if (!Number.isFinite(state.finalScore)) continue;

  if (Math.abs(state.finalScore!) > hyperParams.signalThreshold) {
    const isNewToken = historyCount < 3;
    const sampleSizePenalty = historyCount <= 3 ? 0.75 : historyCount <= 5 ? 0.9 : 1;

    // metadata.sampleSize cũng dùng historyCount
  }
}
```
