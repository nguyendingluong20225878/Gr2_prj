## Fixed Issues
- issue: `core/news-scraper/src/process.ts/buildTokenMatchers` match bare ticker case-insensitive.
- trạng thái: Fixed.
- nhận xét: Patch bỏ flag `"i"` và chỉ giữ `$TOKEN`, `$token`, bare `TOKEN`, `Name Capitalized`, `NAME`. Fix đúng lỗi false-positive như ticker `IN` match từ `"in"`.

- issue: `core/signal-detector/scripts/run-quant.ts/main` reset `status: "RAW"` trên signal đã tồn tại.
- trạng thái: Partially fixed.
- nhận xét: Patch đã chuyển `status: "RAW"` vào `$setOnInsert`, nên không còn reprocess loop trực tiếp. Tuy nhiên filter upsert vẫn là `tokenSymbol + createdAt >= startOfDay`, nên quant mới trong ngày vẫn ghi đè score/source của signal đã `PROCESSED` mà Layer3 không chạy lại.

- issue: `core/x-scaper/src/db.ts/saveTweets` nuốt lỗi insert fatal và vẫn update `lastTweetUpdatedAt`.
- trạng thái: Fixed.
- nhận xét: Patch phân biệt duplicate-only với lỗi thật; lỗi non-duplicate now `throw err`, nhảy ra catch tổng và không update checkpoint. Fix đúng boundary chống mất tweet.

- issue: `core/signal-detector/scripts/run-quant.ts/main` dùng `quantScore` làm `historicalData.unifiedRaw`.
- trạng thái: Fixed.
- nhận xét: Patch lấy `metadata.scoreComponents.unifiedRaw` trước, fallback `quantScore` cho dữ liệu cũ và bỏ record không finite. Fix đúng hướng, giảm double-normalization.

- issue: `core/signal-detector/src/alpha-analyzer.ts/evaluateAlphaAndCross` MAD dùng raw history có thể chứa `NaN`.
- trạng thái: Partially fixed.
- nhận xét: EMA/MAD đã dùng `historyValues` finite và có guard `Number.isFinite(finalScore)`. Nhưng các nhánh sau vẫn dùng `history.length`, tạo bug mới khi history có nhiều record nhưng ít record hợp lệ.

- issue: `core/signal-detector/src/document-processor.ts/processDocuments` score text news bằng title/summary thiếu guard và token `.trim()` có thể crash.
- trạng thái: Partially fixed.
- nhận xét: Text scoring đã dùng `[title, summary, content].filter(Boolean).join()` và skip text rỗng. Token null guard có rồi, nhưng filter `token.name.length >= 2` có thể loại token hợp lệ chỉ có symbol.

- issue: `core/layer3/src/workflow.ts/processSignal` không copy `uncertaintyEntropy`, `realizedVolatility`, `signalMode`.
- trạng thái: Mostly fixed.
- nhận xét: Patch đã copy thêm các field này, `scoreComponents`, `expiresAt`, `detectedAt`. Schema proposal vẫn chưa khai báo `detectedAt` trong interface/schema chính, nhưng `strict: false` nên Mongo vẫn lưu được.

- issue: `apps/web/app/api/proposals/route.ts/GET` default missing action thành `"BUY"` và override bằng title.
- trạng thái: Fixed.
- nhận xét: Patch thêm `normalizeAction` và bỏ suy luận theo title. Missing/unknown action giờ trả `"UNKNOWN"` thay vì BUY.

- issue: `core/research/backtest/engine.ts/resolveDetectedAt` dùng proposal `createdAt` thay vì signal detected time.
- trạng thái: Partially fixed.
- nhận xét: Patch đã lookup `signalsTable` bằng `proposal.signalId`. Chưa xử lý proposal legacy dùng `triggerSignalId`, nên một phần dữ liệu cũ vẫn backtest sai timestamp.

- issue: `core/run/src/index.ts/start` comment toàn bộ X scraper.
- trạng thái: Partially fixed.
- nhận xét: Patch bật lại X scraper bằng `RUN_X_SCRAPER !== "false"`. Tuy nhiên implementation không kiểm tra credential, khác patch plan “bật khi có credential”, gây bug mới ở môi trường thiếu X credentials.

- issue: `core/signal-detector/src/finbert.ts/finBertProbs` comment timeout sai.
- trạng thái: Fixed.
- nhận xét: Comment đã đổi sang 40 giây, khớp code.

- issue: `apps/web/app/api/signals/[id]/route.ts/GET` local schema dùng `symbol` thay vì `tokenSymbol`.
- trạng thái: Mostly fixed.
- nhận xét: Route đã thêm `tokenSymbol` làm field chính nhưng vẫn giữ `symbol` optional để tương thích. Không còn lệch field chính.

- issue: `core/token-price-fetcher/src/services/token-price-service.ts/TokenPriceService.updatePrices` gọi `bulkWrite([])`.
- trạng thái: Fixed.
- nhận xét: Patch thêm guard `if (bulkOps.length === 0) return`, fix đúng empty CoinGecko response case.

## Remaining Issues
- issue: `core/signal-detector/scripts/run-quant.ts/main`
- trạng thái: Còn tồn tại một phần.
- nhận xét: Upsert theo `tokenSymbol + createdAt >= startOfDay` vẫn collapse nhiều signal intraday thành một document. Fix chỉ chặn reset `RAW`, chưa giải quyết data consistency: signal/proposal đã xử lý có thể giữ rationale cũ nhưng quantScore/sources trên signal đã đổi.

- issue: `core/research/backtest/engine.ts/resolveDetectedAt`
- trạng thái: Còn tồn tại với dữ liệu legacy.
- nhận xét: Function chỉ lookup `proposal.signalId`. Các proposal dùng `triggerSignalId` theo schema/web API sẽ fallback về `createdAt/updatedAt`, nên entry price vẫn có thể lệch khỏi thời điểm signal.

- issue: `core/layer3/src/workflow.ts/processSignal`
- trạng thái: Còn thiếu schema contract.
- nhận xét: Code set `detectedAt` vào proposal nhưng `core/shared/src/db/schema/proposal.ts` chưa khai báo field `detectedAt` trong interface/schema. Vì `strict: false`, runtime vẫn lưu, nhưng type/schema contract không rõ và dễ bị bỏ sót ở code khác.

## New Issues (QUAN TRỌNG)
- issue: `core/run/src/index.ts/start`
- trạng thái: New bug do patch.
- nhận xét: `const shouldRunXScraper = process.env.RUN_X_SCRAPER !== "false"` khiến X scraper chạy mặc định kể cả khi thiếu `X_EMAIL/X_PASSWORD/X_USERNAME`. `core/x-scaper/scripts/run-scraper.ts` exit code `1` khi credential thiếu; `execSync` throw và toàn bộ try block dừng, nên bước quant và Layer3 không chạy.

- issue: `core/signal-detector/src/alpha-analyzer.ts/evaluateAlphaAndCross`
- trạng thái: New bug do partial fix.
- nhận xét: Function tính `historyValues` finite nhưng các nhánh cold-start, beta, cross-section vẫn dùng `history.length`. Nếu history có 3 document nhưng chỉ 2 `unifiedRaw` hợp lệ, token được xem là `NORMALIZED_ALPHA`, tham gia beta/cross, trong khi `timeZ` lại xử lý như cold-start.

- issue: `core/signal-detector/src/document-processor.ts/processDocuments`
- trạng thái: New regression risk from patch.
- nhận xét: `compiledTokens` filter `token.symbol.length >= 2 && token.name.length >= 2`. Token có symbol hợp lệ nhưng `name` thiếu/rỗng sẽ bị loại hoàn toàn, dù matching theo symbol vẫn đủ an toàn. Điều này có thể làm mất signal cho token mới/import chưa đủ metadata.

- issue: `core/run/src/index.ts/acquirePipelineLock`
- trạng thái: New operational risk.
- nhận xét: Distributed lock TTL cố định 10 phút. Nếu X scraping + quant + Layer3 chạy lâu hơn 10 phút, process khác có thể lấy lock stale và chạy song song. Điều này phá mục tiêu “tránh cron chạy chồng”, nhất là Selenium thường có thể chạy lâu.

- issue: `core/token-price-fetcher/src/services/token-price-service.ts/backfillHistoricalPrices`
- trạng thái: New side-effect risk.
- nhận xét: Patch thêm concurrency nhưng vẫn dùng một `delayMs` trong từng worker. Với `concurrency > 1`, nhiều worker vẫn có thể gọi CoinGecko cùng lúc, làm tăng rủi ro rate-limit so với logic tuần tự cũ. Demo mode default `concurrency = 3`, `delayMs = 0`.

## Regression Risks
- issue: Signal/proposal consistency after intraday update.
- trạng thái: Risk cao.
- nhận xét: Sau patch, signal đã `PROCESSED` không bị set `RAW`, nhưng quant fields vẫn bị update. Proposal linked với signal đó không được regenerate, nên UI có thể hiển thị signal score mới nhưng rationale/proposal cũ.

- issue: Cold-start classification consistency.
- trạng thái: Risk trung bình.
- nhận xét: Patch dùng `historyValues.length` ở bước timeZ nhưng dùng `history.length` ở các bước sau. Regression này chỉ xuất hiện khi có dữ liệu lịch sử bẩn, đúng case patch đang cố xử lý.

- issue: X scraper default behavior.
- trạng thái: Risk cao.
- nhận xét: Trước patch, thiếu X credentials không chặn quant/Layer3 vì scraper bị comment. Sau patch, thiếu credentials làm `run-scraper.ts` exit `1` và pipeline bỏ qua toàn bộ signal detector.

- issue: Token coverage.
- trạng thái: Risk trung bình.
- nhận xét: Trước patch, token thiếu name có thể crash batch; sau patch, batch không crash nhưng token đó biến mất khỏi detector. Cần chọn fallback symbol-only thay vì drop.

- issue: Backtest old proposal compatibility.
- trạng thái: Risk trung bình.
- nhận xét: Proposal mới từ Layer3 có `signalId/detectedAt`, nhưng legacy proposal dùng `triggerSignalId` vẫn chưa được backtest bằng timestamp đúng.
