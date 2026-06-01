## Fix 1
- Issue:
  - X scraper có thể làm crash toàn bộ master pipeline khi thiếu credential hoặc khi scraper fail.
- File:
  - `core/run/src/index.ts`
- Before:
  - `RUN_X_SCRAPER !== "false"` là chạy scraper mặc định.
  - `execSync` của scraper nằm chung `try/catch` với quant và Layer3.
  - Scraper fail sẽ nhảy ra catch tổng và bỏ qua các bước sau.
- After:
  - Chỉ chạy scraper khi `RUN_X_SCRAPER=true` hoặc khi `RUN_X_SCRAPER` không phải `false` và có đủ `X_EMAIL`, `X_PASSWORD`, `X_USERNAME`.
  - Bọc riêng bước scraper bằng `try/catch`.
  - Scraper lỗi sẽ log error rồi tiếp tục chạy quant và Layer3.
- Why safe:
  - Không sửa script scraper.
  - Production có đủ credential vẫn chạy như trước.
  - Môi trường thiếu credential tự skip, không phá pipeline chính.

## Fix 2
- Issue:
  - Quant upsert có thể overwrite signal đã `PROCESSED`, làm signal mới và proposal cũ không còn consistent.
- File:
  - `core/signal-detector/scripts/run-quant.ts`
- Before:
  - Upsert filter chỉ match `tokenSymbol + createdAt >= startOfDay`.
  - Signal đã `PROCESSED` trong ngày vẫn có thể bị update score/sources/metadata.
- After:
  - Thêm `status: { $ne: "PROCESSED" }` vào filter upsert.
  - Nếu chỉ còn signal đã `PROCESSED`, upsert sẽ insert signal mới với `status: "RAW"` và `detectedAt` mới.
- Why safe:
  - Chỉ đổi điều kiện match document.
  - Không đổi schema, payload, hoặc Layer3 contract.
  - Proposal cũ tiếp tục gắn với signal cũ, signal mới được xử lý riêng.

## Fix 3
- Issue:
  - Pipeline lock TTL là 10 phút; pipeline chạy lâu hơn TTL có thể bị process khác coi là stale và chạy song song.
- File:
  - `core/run/src/index.ts`
- Before:
  - Lock chỉ set `lockedAt` khi acquire.
  - Không refresh lock trong lúc pipeline còn sống.
- After:
  - Thêm `refreshPipelineLock(owner)` để heartbeat `lockedAt`.
  - Set interval refresh mỗi `Math.max(30_000, LOCK_TTL_MS / 3)`.
  - Clear interval trong `finally` trước khi release lock.
- Why safe:
  - Giữ nguyên TTL và schema lock.
  - Lock cũ vẫn tương thích.
  - Nếu process chết, heartbeat dừng nên stale recovery vẫn hoạt động.

## Fix 4
- Issue:
  - `alpha-analyzer` tính finite history cho timeZ nhưng các nhánh beta/cross/cold-start vẫn dùng raw `history.length`.
- File:
  - `core/signal-detector/src/alpha-analyzer.ts`
- Before:
  - Token có đủ document history nhưng thiếu giá trị finite có thể bị phân loại `NORMALIZED_ALPHA` dù timeZ đang xử lý như cold-start.
  - `validAlphas`, `isNewToken`, `sampleSizePenalty`, metadata `sampleSize` dùng raw count.
- After:
  - Lưu `finiteHistoryValuesBySymbol`.
  - Dùng finite history count cho beta neutralization, cross-section filter, final score branch, `isNewToken`, penalty, và metadata `sampleSize`.
  - Lọc `validAlphas` không finite.
- Why safe:
  - Không đổi công thức khi dữ liệu history sạch.
  - Chỉ làm consistent các guard đã có từ fix trước.
  - Backward-compatible với dữ liệu cũ có record bẩn.
