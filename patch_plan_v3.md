## HIGH

### Issue 1
- Test case: Test Case 8 - Gemini timeout/500 khi xử lý một `RAW` signal.
- Root cause: [system failure] `core/layer3/src/workflow.ts`, function `runLayer3Batch`. Catch block đang set mọi lỗi thành `status: "FAILED"`, trong khi batch sau chỉ query `{ status: "RAW" }`. Lỗi tạm thời từ LLM làm signal bị bỏ qua vĩnh viễn.
- Fix strategy:
  - Không biến lỗi external/transient thành non-retryable `FAILED`.
  - Khi `layer3Graph.invoke` throw do Gemini/network/timeout, giữ signal retryable bằng `status: "RAW"` và tăng metadata retry count.
  - Chỉ set `FAILED` cho lỗi validation/data không thể retry, ví dụ thiếu `tokenSymbol`, `tokenAddress`, `suggestionType`, `sentimentType`.
  - Minimal patch:
```ts
// core/layer3/src/workflow.ts
catch (error) {
  const reason = error instanceof Error ? error.message : "Unknown error";
  await signalsTable.updateOne(
    { _id: signal._id },
    {
      $set: {
        status: "RAW",
        updatedAt: new Date(),
        lastLayer3Error: reason,
      },
      $inc: { layer3RetryCount: 1 },
    }
  );
  results.push({ status: "RETRYABLE_FAILED" as const, tokenSymbol: signal.tokenSymbol, reason });
}
```

### Issue 2
- Test case: Test Case 10 - DB outage xảy ra trong lúc master cron release lock.
- Root cause: [system failure] `core/run/src/index.ts`, functions `releasePipelineLock` và cron callback `finally`. `await releasePipelineLock(lockOwner)` chạy trước `isRunning = false` và không có `try/catch`; nếu DB update fail, process giữ `isRunning = true`.
- Fix strategy:
  - Đảm bảo in-memory lock luôn được reset dù DB release fail.
  - Wrap `releasePipelineLock` trong `try/catch`.
  - Set `isRunning = false` trong `finally` độc lập với kết quả release DB lock.
  - Minimal patch:
```ts
// core/run/src/index.ts
finally {
  if (lockHeartbeat) clearInterval(lockHeartbeat);

  try {
    await releasePipelineLock(lockOwner);
  } catch (error) {
    logger.error("Không thể release pipeline lock:", error);
  } finally {
    isRunning = false;
  }
}
```

### Issue 3
- Test case: New Bug 2 - Later quant run ghi dữ liệu mới vào signal `FAILED` nhưng Layer3 không thấy.
- Root cause: [data consistency] `core/signal-detector/scripts/run-quant.ts`, function `main`. Upsert filter match mọi same-day signal có `status != "PROCESSED"`, gồm cả `FAILED`; `$set` update score/source nhưng không set lại `status: "RAW"` vì status chỉ nằm trong `$setOnInsert`.
- Fix strategy:
  - Không update vào signal `FAILED` cũ theo same-day token.
  - Chỉ update signal đang retryable/active, ví dụ `RAW` hoặc status missing legacy.
  - Nếu signal duy nhất trong ngày đang `FAILED`, upsert nên insert signal mới `RAW`.
  - Minimal patch:
```ts
// core/signal-detector/scripts/run-quant.ts
filter: {
  tokenSymbol: symbol,
  createdAt: { $gte: startOfDay },
  $or: [
    { status: "RAW" },
    { status: { $exists: false } }, // legacy compatibility
  ],
},
update: {
  $set: {
    // giữ các field quant hiện tại
    updatedAt: new Date(),
  },
  $setOnInsert: {
    createdAt: new Date(),
    detectedAt: new Date(),
    status: "RAW",
  },
},
upsert: true,
```

## MEDIUM

### Issue 1
- Test case: New Bug 4 - `/api/proposals` trả semantic giả khi proposal thiếu field.
- Root cause: [logic] `apps/web/app/api/proposals/route.ts`, function `GET`. API default missing `confidence` thành `85`, default missing ROI thành `0`, rồi derive `sentimentType` từ ROI nên proposal thiếu dữ liệu có thể hiện confidence cao và positive sentiment.
- Fix strategy:
  - Không fabricate confidence/sentiment khi field thiếu.
  - Nếu `confidence` missing, trả `null` hoặc `0` tùy UI contract; ưu tiên `null` nếu client chịu được, nếu không thì `0`.
  - `sentimentType` nên lấy từ DB field nếu có; nếu thiếu thì `"unknown"` thay vì suy từ ROI fallback.
  - Minimal patch:
```ts
// apps/web/app/api/proposals/route.ts
const rawConfidence = typeof p.confidence === "number" ? p.confidence : null;
const confidence =
  rawConfidence === null ? null :
  rawConfidence <= 1 ? Math.round(rawConfidence * 100) :
  rawConfidence;

const roi = p.financialImpact?.roi ?? p.financialImpact?.percentChange ?? null;
const sentimentType = p.sentimentType ?? "unknown";
```

### Issue 2
- Test case: Test Case 8 follow-up - retryable Layer3 failure có thể retry vô hạn nếu Gemini outage kéo dài.
- Root cause: [system failure] `core/layer3/src/workflow.ts`, function `runLayer3Batch`. Sau khi đổi transient failure về retryable, cần giới hạn retry để tránh mỗi batch gọi lại cùng signal mãi.
- Fix strategy:
  - Thêm retry cap nhỏ, ví dụ `LAYER3_MAX_RETRY` default `3`.
  - Query `RAW` signal nhưng bỏ qua signal có `layer3RetryCount >= maxRetry`.
  - Khi quá retry cap, set `status: "FAILED"` có `errorType: "LAYER3_RETRY_EXHAUSTED"`.
  - Giữ backward compatibility bằng cách coi missing `layer3RetryCount` là `0`.

## LOW

### Issue 1
- Test case: Test Case 12 note - heartbeat interval dùng `Math.max(30_000, LOCK_TTL_MS / 3)`.
- Root cause: [edge case] `core/run/src/index.ts`, cron callback heartbeat. Nếu test hoặc env giảm TTL xuống dưới 30 giây, interval 30 giây có thể dài hơn TTL.
- Fix strategy:
  - Tính interval luôn nhỏ hơn TTL.
  - Với TTL nhỏ, dùng `Math.max(1_000, Math.floor(LOCK_TTL_MS / 3))` thay vì hard floor 30 giây.
  - Minimal patch:
```ts
const heartbeatIntervalMs = Math.max(1_000, Math.floor(LOCK_TTL_MS / 3));
lockHeartbeat = setInterval(() => {
  refreshPipelineLock(lockOwner).catch((error) => {
    logger.error("Không thể refresh pipeline lock:", error);
  });
}, heartbeatIntervalMs);
```

### Issue 2
- Test case: Test Case 1 note - ETH news chỉ hoạt động nếu seeded article có `detectedTokens`.
- Root cause: [edge case] `core/signal-detector/src/document-processor.ts`, function `processDocuments`. News path tin vào `doc.detectedTokens`; quant không scan body trực tiếp cho news.
- Fix strategy:
  - Không đổi ngay trong production patch vì đây là intentional contract giữa scraper và quant.
  - Thêm integration fixture requirement: news seed phải có `detectedTokens`.
  - Nếu cần runtime fallback sau này, chỉ scan news body khi `detectedTokens` missing, không thay thế flow hiện tại.

