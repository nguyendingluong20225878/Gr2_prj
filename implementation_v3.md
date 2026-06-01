## HIGH

### Issue 1
- Issue: Gemini/network/timeout lỗi khi xử lý `RAW` signal làm signal bị set `FAILED` vĩnh viễn.
- File: `core/layer3/src/workflow.ts`
- Before: `runLayer3Batch` catch mọi exception và set signal thành `FAILED`, batch sau chỉ query `RAW`.
- After: Exception runtime được ghi thành retryable failure: giữ `status: "RAW"`, lưu `lastLayer3Error`, tăng `layer3RetryCount`; khi vượt retry cap thì mới set `FAILED`.
- Why safe: Validation lỗi không retry vẫn được `processSignal` xử lý thành `FAILED`; chỉ lỗi throw từ external/runtime được retry có giới hạn.

### Issue 2
- Issue: DB outage khi release master cron lock có thể khiến `isRunning` giữ `true`.
- File: `core/run/src/index.ts`
- Before: `await releasePipelineLock(lockOwner)` chạy trực tiếp trước `isRunning = false`; release fail làm callback thoát sớm.
- After: Bọc release lock trong `try/catch`, và reset `isRunning = false` trong nested `finally`.
- Why safe: Không đổi semantics DB lock khi release thành công; chỉ đảm bảo in-memory guard luôn được dọn.

### Issue 3
- Issue: Quant run sau có thể update signal `FAILED` cùng ngày nhưng Layer3 không query signal đó.
- File: `core/signal-detector/scripts/run-quant.ts`
- Before: Upsert filter dùng `status: { $ne: "PROCESSED" }`, nên match cả `FAILED`.
- After: Upsert chỉ match signal đang `RAW` hoặc legacy signal thiếu `status`; nếu same-day signal đang `FAILED`, upsert sẽ insert signal mới `RAW`.
- Why safe: Giữ backward compatibility cho data cũ thiếu `status`, không đụng signal đã `PROCESSED` hoặc `FAILED`.

## MEDIUM

### Issue 1
- Issue: `/api/proposals` fabricate semantic khi proposal thiếu confidence/ROI/sentiment.
- File: `apps/web/app/api/proposals/route.ts`
- Before: Missing confidence default `85`; missing ROI default `0`; sentiment derive từ ROI fallback nên dễ thành positive giả.
- After: Missing confidence trả `null`; ROI thiếu trả `null`; `sentimentType` lấy từ DB, thiếu thì trả `"unknown"`.
- Why safe: Không đổi các field có dữ liệu hợp lệ; chỉ tránh bịa giá trị khi DB thiếu dữ liệu.

### Issue 2
- Issue: Retryable Layer3 failure có thể retry vô hạn khi Gemini outage kéo dài.
- File: `core/layer3/src/workflow.ts`
- Before: Không có retry cap cho signal `RAW` lỗi liên tục.
- After: Thêm `LAYER3_MAX_RETRY` với default `3`; query `RAW` bỏ qua retry count đã vượt cap; lần lỗi đạt cap set `FAILED` với `errorType: "LAYER3_RETRY_EXHAUSTED"`.
- Why safe: Missing `layer3RetryCount` được coi là `0`; default nhỏ và có env override.

## LOW

### Issue 1
- Issue: Heartbeat interval có floor 30s, có thể dài hơn TTL nếu TTL bị giảm trong test/env.
- File: `core/run/src/index.ts`
- Before: `Math.max(30_000, Math.floor(LOCK_TTL_MS / 3))`.
- After: `Math.max(1_000, Math.floor(LOCK_TTL_MS / 3))`.
- Why safe: Với TTL hiện tại 10 phút vẫn refresh mỗi khoảng 3 phút 20 giây; chỉ an toàn hơn khi TTL nhỏ.

### Issue 2
- Issue: ETH news integration fixture cần `detectedTokens`; production quant đang intentionally tin vào contract từ news scraper.
- File: Không đổi production code.
- Before: News path không scan body fallback khi thiếu `detectedTokens`.
- After: Không patch runtime trong lượt này; giữ contract fixture như patch plan v3 đề xuất.
- Why safe: Tránh đổi behavior production ngoài phạm vi; issue này là test fixture/contract note, không phải FAILED runtime patch bắt buộc.

## Verification
- `tsc -p core/layer3/tsconfig.json --noEmit`: passed.
- `tsc -p core/run/tsconfig.json --noEmit`: passed.
- `tsc -p core/signal-detector/tsconfig.json --noEmit`: passed.
- `tsc -p apps/web/tsconfig.json --noEmit`: passed.
