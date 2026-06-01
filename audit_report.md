## HIGH (critical)
- file: `core/news-scraper/src/process.ts`
- function: `buildTokenMatchers`
- vấn đề: Regex symbol chạy với flag `"i"` cho toàn bộ pattern, nên bare ticker cũng bị match không phân biệt hoa/thường. Ví dụ `symbolUpper = "IN"` nhưng regex `new RegExp(..., "i")` sẽ match cả từ thường `"in"`.
- tại sao nguy hiểm: News scraper ghi `detectedTokens` sai, sau đó `core/signal-detector/src/document-processor.ts/processDocuments` tin tuyệt đối vào `detectedTokens` của news. Một bài viết không liên quan vẫn có thể tạo signal cho token có ticker trùng từ phổ biến.
- ví dụ lỗi: Bài CoinDesk có câu `"Bitcoin ETF inflows rose in May"` có thể bị detect token `IN` nếu DB tokens có ticker `IN`; signal detector sẽ chấm FinBERT bài đó cho token `IN` và có thể tạo proposal sai.

- file: `core/signal-detector/scripts/run-quant.ts`
- function: `main`
- vấn đề: Upsert signal theo `{ tokenSymbol, createdAt: { $gte: startOfDay } }`, mỗi lần cron chạy lại cập nhật cùng một document trong ngày và set `status: "RAW"`.
- tại sao nguy hiểm: Một signal đã được Layer3 xử lý thành proposal có thể bị reset về `RAW`, bị xử lý lại, proposal bị ghi đè rationale. Đồng thời hệ thống mất lịch sử intraday vì nhiều lần phát hiện trong ngày bị gộp thành một bản ghi.
- ví dụ lỗi: 09:00 `SOL` được tạo signal và Layer3 set `status = PROCESSED`; 09:01 cron chạy quant lại, update đúng document `SOL` hôm nay và set `status = RAW`; Layer3 tạo/ghi đè proposal lần nữa dù signal gốc đã xử lý.

- file: `core/x-scaper/src/db.ts`
- function: `saveTweets`
- vấn đề: `insertMany` lỗi non-duplicate chỉ `console.error` nhưng không throw/return fail; sau đó hàm vẫn update `x_accounts.lastTweetUpdatedAt` bằng newest tweet trong batch.
- tại sao nguy hiểm: Nếu Mongo insert fail vì validation/network/schema, account vẫn bị đánh dấu đã scrape tới timestamp mới nhất. Lần chạy sau dùng cutoff này và bỏ qua các tweet chưa từng lưu, gây mất dữ liệu vĩnh viễn.
- ví dụ lỗi: Batch 20 tweet của account `cz_binance` fail vì một document thiếu `url`; catch in `"DB FATAL ERROR"` chỉ log, rồi `lastTweetUpdatedAt` vẫn nhảy lên tweet mới nhất. 20 tweet đó không còn được scrape lại.

- file: `core/signal-detector/scripts/run-quant.ts`
- function: `main`
- vấn đề: `historicalData` được build từ `signals.quantScore` nhưng `core/signal-detector/src/alpha-analyzer.ts/evaluateAlphaAndCross` lại coi `history[].unifiedRaw` là raw score trước chuẩn hóa.
- tại sao nguy hiểm: Hệ thống dùng final normalized score của lần trước làm raw baseline cho lần sau, gây double-normalization và feedback loop. Z-score hiện tại không còn so với cùng đại lượng lịch sử.
- ví dụ lỗi: Ngày 1 `ETH` có `unifiedRaw = 0.8`, sau alpha/cross thành `quantScore = 2.4`. Ngày 2 current `unifiedRaw = 0.9` bị so với history `2.4`, nên `timeZ` có thể thành âm dù sentiment thực tế tăng.

## MEDIUM
- file: `core/signal-detector/src/alpha-analyzer.ts`
- function: `evaluateAlphaAndCross`
- vấn đề: `historyValues` đã filter finite để tính EMA, nhưng MAD lại dùng `calcMAD(history.map(h => h.unifiedRaw))` chưa filter `NaN/null/undefined`.
- tại sao nguy hiểm: Chỉ cần một history record lỗi, `mad7` có thể thành `NaN`; `safeMad = Math.max(NaN, 0.01)` vẫn là `NaN`; `timeZ/finalScore` thành `NaN` và signal bị rớt im lặng.
- ví dụ lỗi: Một signal cũ thiếu `quantScore` được map thành `unifiedRaw: undefined`; token đó không bao giờ vượt `Math.abs(state.finalScore) > threshold` vì `Math.abs(NaN)` là `NaN`.

- file: `core/signal-detector/src/document-processor.ts`
- function: `processDocuments`
- vấn đề: Cache FinBERT theo `textToScore` nhưng không validate text rỗng/undefined; news dùng template `${doc.title}\n${doc.summary}` nên summary thiếu sẽ thành chuỗi `"undefined"`.
- tại sao nguy hiểm: Model sentiment nhận input nhiễu và trả xác suất cho text không đại diện bài viết. Các article chỉ có `content` nhưng thiếu `summary` không dùng phần `content` trong scoring.
- ví dụ lỗi: News scraper lưu title đúng, content 5.000 ký tự, summary `""`; detector chỉ chấm `"Title\n"` thay vì nội dung bài, làm baseScore lệch khỏi sentiment thật.

- file: `core/layer3/src/workflow.ts`
- function: `processSignal`
- vấn đề: Khi ghi proposal, chỉ copy `volatilityFlag` và `scoreComponents`, không copy các field mới `uncertaintyEntropy`, `realizedVolatility`, `signalMode`.
- tại sao nguy hiểm: Proposal là layer người dùng đọc quyết định, nhưng mất chỉ báo uncertainty/mode từ signal. UI phải fallback không nhất quán, backtest/report có thể thiếu thông tin cold-start.
- ví dụ lỗi: Signal `COLD_START` confidence 0.35 có `uncertaintyEntropy = 0.98`; proposal được upsert không có `signalMode`, khiến màn proposal không cảnh báo đúng trạng thái cold-start.

- file: `apps/web/app/api/proposals/route.ts`
- function: `GET`
- vấn đề: `action` default là `"BUY"` nếu proposal không có `action/suggestionType`; sau đó còn override action bằng text trong `title`.
- tại sao nguy hiểm: API list proposal có thể hiển thị BUY cho proposal thiếu field hoặc title chứa từ khóa gây nhiễu, trái với quant ground truth.
- ví dụ lỗi: Proposal cũ có `suggestionType` rỗng, `title = "SOL risk review"` sẽ trả `action: "BUY"` dù không có tín hiệu mua.

- file: `core/research/backtest/engine.ts`
- function: `resolveDetectedAt`
- vấn đề: Backtest dùng `proposal.detectedAt ?? proposal.createdAt ?? proposal.updatedAt`, nhưng proposal schema không có `detectedAt` và Layer3 không copy `signal.detectedAt`.
- tại sao nguy hiểm: Entry price backtest bị lấy tại thời điểm proposal được tạo, không phải thời điểm signal được phát hiện. Nếu Layer3 chạy trễ, PnL/win-rate sai.
- ví dụ lỗi: Signal phát hiện lúc 09:00, Layer3 tạo proposal lúc 09:20; backtest lấy entry price quanh 09:20, bỏ qua biến động 20 phút đầu sau signal.

- file: `core/run/src/index.ts`
- function: `start`
- vấn đề: Cron chạy mỗi phút nhưng bước X scraper bị comment toàn bộ; pipeline chỉ chạy signal detector và Layer3 trên dữ liệu cũ.
- tại sao nguy hiểm: Hệ thống trông như realtime nhưng không nạp tweet mới. Quant có thể tái xử lý dữ liệu 24h cũ mỗi phút, tạo cảm giác signal mới trong khi raw data không đổi.
- ví dụ lỗi: Account KOL đăng tin bearish mới lúc 10:05, cron 10:06 không scrape X nên signal detector không thấy tweet đó; dashboard vẫn cập nhật `updatedAt` từ dữ liệu cũ.

## LOW
- file: `core/signal-detector/src/finbert.ts`
- function: `finBertProbs`
- vấn đề: Comment nói timeout 10 giây nhưng code dùng `setTimeout(..., 40000)`.
- tại sao nguy hiểm: Người vận hành tuning theo comment sẽ hiểu sai latency/rate-limit. Một batch 100 document có thể treo lâu hơn dự kiến.
- ví dụ lỗi: Tưởng timeout mỗi request 10s nên set cron 1 phút; thực tế 3 retries có thể kéo dài hơn 2 phút cho một document lỗi mạng.

- file: `core/signal-detector/src/document-processor.ts`
- function: `processDocuments`
- vấn đề: `knownTokens.map` gọi trực tiếp `token.symbol.trim()` và `token.name.trim()` không guard null/undefined.
- tại sao nguy hiểm: Một token record thiếu `name` hoặc `symbol` làm toàn bộ quant batch crash trước khi xử lý document nào.
- ví dụ lỗi: DB có token `{ symbol: "WIF", name: null }`; detector throw `Cannot read properties of null (reading 'trim')`.

- file: `apps/web/app/api/signals/[id]/route.ts`
- function: `GET`
- vấn đề: Route định nghĩa local `SignalSchema` yêu cầu field `symbol`, trong khi schema chuẩn dùng `tokenSymbol`.
- tại sao nguy hiểm: Dù `strict: false` giúp query vẫn chạy, type/model local lệch schema chuẩn làm code detail dễ đọc nhầm field và tăng rủi ro bug khi thêm validation.
- ví dụ lỗi: Dev mới dùng `signal.symbol` từ type `SignalDetailRecord`, API trả undefined vì document thật chỉ có `tokenSymbol`.

- file: `core/token-price-fetcher/src/services/token-price-service.ts`
- function: `TokenPriceService.updatePrices`
- vấn đề: `bulkWrite` được gọi ngay cả khi `bulkOps.length === 0`.
- tại sao nguy hiểm: Khi CoinGecko không trả giá cho toàn bộ ids, job có thể lỗi không cần thiết thay vì log “0 prices updated” và kết thúc sạch.
- ví dụ lỗi: CoinGecko rate-limit trả data rỗng/thiếu giá; `bulkOps` rỗng, Mongo `bulkWrite([])` có thể throw và làm cron price update fail.
