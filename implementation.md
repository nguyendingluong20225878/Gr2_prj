## Fix 1
- File: `core/news-scraper/src/process.ts`
- Trước:
  - `buildTokenMatchers` tạo regex với flag `i`.
  - Bare ticker và token name đều match không phân biệt hoa/thường.
- Sau:
  - Bỏ flag `i`.
  - Bare ticker chỉ match uppercase.
  - Cashtag vẫn match `$TOKEN` và `$token`.
  - Token name chỉ match dạng Capitalized hoặc UPPERCASE.
- Giải thích:
  - Giảm false-positive với ticker ngắn như `IN`, `ON`, `AI` mà không đổi flow scraper.

## Fix 2
- File: `core/signal-detector/scripts/run-quant.ts`
- Trước:
  - Upsert signal luôn `$set status: "RAW"` khi match token trong ngày.
  - Signal đã `PROCESSED` có thể bị reset và xử lý lại.
- Sau:
  - Bỏ `status` khỏi `$set`.
  - Chỉ set `status: "RAW"` trong `$setOnInsert`.
  - Thêm `detectedAt` khi insert mới.
- Giải thích:
  - Chặn reprocessing loop nhưng vẫn cho phép cập nhật score/metadata của signal trong ngày.

## Fix 3
- File: `core/x-scaper/src/db.ts`
- Trước:
  - `insertMany` lỗi non-duplicate chỉ log lỗi rồi tiếp tục update `lastTweetUpdatedAt`.
- Sau:
  - Phân biệt lỗi duplicate-only với lỗi insert thật.
  - Duplicate-only vẫn được coi là persistence thành công.
  - Lỗi non-duplicate được throw để không update checkpoint.
- Giải thích:
  - Tránh mất tweet vĩnh viễn khi DB insert fail nhưng checkpoint vẫn nhảy lên.

## Fix 4
- File: `core/signal-detector/scripts/run-quant.ts`
- Trước:
  - `historicalData` dùng `quantScore` làm `unifiedRaw`.
- Sau:
  - Ưu tiên lấy `metadata.scoreComponents.unifiedRaw`.
  - Fallback sang `quantScore` cho dữ liệu cũ.
  - Bỏ qua history raw không finite.
- Giải thích:
  - Tránh double-normalization và giữ tương thích dữ liệu lịch sử.

## Fix 5
- File: `core/signal-detector/src/alpha-analyzer.ts`
- Trước:
  - EMA lọc finite nhưng MAD vẫn tính trên raw history.
  - `NaN/null/undefined` trong history có thể làm final score thành `NaN`.
- Sau:
  - Dùng cùng `historyValues` đã lọc finite cho EMA và MAD.
  - History finite dưới 3 điểm xử lý như cold-start.
  - Bỏ qua signal nếu `finalScore` không finite.
- Giải thích:
  - Chặn NaN propagation mà không đổi công thức khi dữ liệu hợp lệ.

## Fix 6
- File: `core/signal-detector/src/document-processor.ts`
- Trước:
  - Compile token gọi `trim()` trực tiếp trên `symbol/name`.
  - News text dùng `${doc.title}\n${doc.summary}`, có thể sinh `"undefined"` và bỏ qua `content`.
- Sau:
  - Chuẩn hóa `symbol/name` bằng `String(... ?? "").trim()`.
  - Bỏ token thiếu symbol/name hợp lệ.
  - News text lấy từ `title`, `summary`, `content` có tồn tại.
  - Skip FinBERT khi text rỗng.
- Giải thích:
  - Giảm input nhiễu cho FinBERT và tránh crash batch vì token record lỗi.

## Fix 7
- File: `core/layer3/src/workflow.ts`
- Trước:
  - Proposal không copy `uncertaintyEntropy`, `realizedVolatility`, `signalMode`, `detectedAt` từ signal.
- Sau:
  - Mở rộng `RawSignal`.
  - Copy thêm các field uncertainty/volatility/mode/timestamp vào proposal.
- Giải thích:
  - Proposal giữ metadata định lượng cần cho UI và backtest, không đổi logic LLM.

## Fix 8
- File: `apps/web/app/api/proposals/route.ts`
- Trước:
  - API default action thành `BUY` nếu thiếu field.
  - Title có keyword `short/sell` có thể override action.
- Sau:
  - Thêm `normalizeAction`.
  - Chỉ nhận `BUY`, `SELL`, `HOLD`; thiếu/không hợp lệ trả `UNKNOWN`.
  - Không override action từ title.
- Giải thích:
  - Presentation API không tự suy luận sai recommendation.

## Fix 9
- File: `core/research/backtest/engine.ts`
- Trước:
  - `resolveDetectedAt` chỉ lấy `proposal.detectedAt`, rồi fallback `createdAt/updatedAt`.
- Sau:
  - Nếu proposal cũ thiếu `detectedAt`, lookup signal bằng `signalId`.
  - Ưu tiên `signal.detectedAt`, fallback `signal.createdAt`, rồi mới dùng timestamp proposal.
- Giải thích:
  - Backtest dùng thời điểm signal đúng hơn mà vẫn chạy được với proposal cũ.

## Fix 10
- File: `core/run/src/index.ts`
- Trước:
  - Bước X scraper bị comment toàn bộ.
- Sau:
  - Bật lại X scraper với flag `RUN_X_SCRAPER`.
  - Default chạy scraper; set `RUN_X_SCRAPER=false` để tắt.
- Giải thích:
  - Pipeline production không chạy quant/layer3 trên dữ liệu X cũ, vẫn có escape hatch cho dev.

## Fix 11
- File: `core/signal-detector/src/finbert.ts`
- Trước:
  - Comment nói timeout 10 giây nhưng code timeout 40 giây.
- Sau:
  - Comment được sửa thành 40 giây ở cả mô tả timeout và fetch signal.
- Giải thích:
  - Không đổi runtime behavior, chỉ sửa documentation sai.

## Fix 12
- File: `apps/web/app/api/signals/[id]/route.ts`
- Trước:
  - Local signal schema dùng `symbol` làm field chính, lệch với schema chuẩn `tokenSymbol`.
- Sau:
  - Thêm `tokenSymbol` vào type/schema.
  - Giữ `symbol` optional để tương thích dữ liệu cũ.
- Giải thích:
  - Giảm schema drift mà không cần migration DB.

## Fix 13
- File: `core/token-price-fetcher/src/services/token-price-service.ts`
- Trước:
  - `updatePrices` gọi `bulkWrite` cả khi `bulkOps.length === 0`.
- Sau:
  - Guard `bulkOps.length === 0`, log warning và return.
- Giải thích:
  - Cron price update kết thúc sạch khi CoinGecko trả data rỗng.
