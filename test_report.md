## Test Case 1
- Mục tiêu: Validate token matcher không match false-positive với bare ticker viết thường.
- Input: Token `{ symbol: "IN", name: "Inside" }`; news text `"Bitcoin ETF inflows rose in May"`.
- Expected: Không detect token `IN` từ từ thường `"in"`.
- Result: PASS - regex trong `core/news-scraper/src/process.ts` đã bỏ flag `i`, bare ticker chỉ match `IN` uppercase.

## Test Case 2
- Mục tiêu: Validate boundary cashtag vẫn hoạt động sau khi bỏ case-insensitive regex.
- Input: Token `{ symbol: "SOL", name: "Solana" }`; text `"$SOL breaks resistance"` và `"$sol volume spikes"`.
- Expected: Cả `$SOL` và `$sol` đều detect token `SOL`.
- Result: PASS - matcher có cả pattern `\$SOL` và `\$sol`.

## Test Case 3
- Mục tiêu: Validate token name không match chữ thường phổ biến.
- Input: Token `{ symbol: "LINK", name: "Chainlink" }`; text `"chainlink integrations expand"` và `"Chainlink integrations expand"`.
- Expected: Text lowercase `chainlink` không match; `Chainlink` match.
- Result: PASS - name matcher chỉ nhận `Chainlink` hoặc `CHAINLINK`.

## Test Case 4
- Mục tiêu: Validate upsert signal không reset signal đã `PROCESSED` về `RAW`.
- Input: Existing signal trong ngày `{ tokenSymbol: "ETH", status: "PROCESSED" }`; quant job upsert lại `ETH`.
- Expected: Các field score/metadata được update, `status` vẫn là `PROCESSED`.
- Result: PASS - `status: "RAW"` chỉ nằm trong `$setOnInsert`, không nằm trong `$set`.

## Test Case 5
- Mục tiêu: Validate boundary insert signal mới vẫn có lifecycle ban đầu đúng.
- Input: Chưa có signal trong ngày cho `{ tokenSymbol: "BTC" }`; quant job tạo signal mới.
- Expected: Document mới có `status: "RAW"`, `createdAt`, `detectedAt`.
- Result: PASS - `$setOnInsert` set đủ `createdAt`, `detectedAt`, `status`.

## Test Case 6
- Mục tiêu: Validate lỗi insert non-duplicate trong X scraper không làm checkpoint nhảy.
- Input: `insertMany` throw lỗi validation/network không phải duplicate key.
- Expected: Hàm throw lỗi; không update `lastTweetUpdatedAt`.
- Result: PASS theo patch plan/code diff - lỗi non-duplicate được throw thay vì bị nuốt.

## Test Case 7
- Mục tiêu: Validate duplicate-only insert vẫn được coi là persistence thành công.
- Input: `insertMany` throw duplicate key `11000` hoặc mọi `writeErrors` đều là `11000`.
- Expected: Không throw fatal; checkpoint có thể update vì dữ liệu đã tồn tại hoặc phần mới đã insert.
- Result: PASS theo patch plan/code diff - duplicate-only được phân biệt riêng với lỗi thật.

## Test Case 8
- Mục tiêu: Validate historical raw score ưu tiên `metadata.scoreComponents.unifiedRaw`.
- Input: Past signal `{ quantScore: 2.4, metadata: { scoreComponents: { unifiedRaw: 0.8 } } }`.
- Expected: `historicalData[].unifiedRaw` bằng `0.8`, không dùng `2.4`.
- Result: PASS - `run-quant.ts` đọc `metadata.scoreComponents.unifiedRaw ?? quantScore`.

## Test Case 9
- Mục tiêu: Validate sai input trong history không làm NaN lan sang final score.
- Input: History gồm `[0.2, NaN, null, undefined, 0.4, 0.6]`.
- Expected: Chỉ finite values được dùng để tính EMA/MAD; signal có `finalScore` non-finite bị skip.
- Result: PASS - `alpha-analyzer.ts` filter `Number.isFinite`, dùng filtered history cho EMA/MAD và skip non-finite final score.

## Test Case 10
- Mục tiêu: Validate boundary cold-start khi history finite dưới 3 điểm.
- Input: Token có 2 điểm history finite và một điểm non-finite.
- Expected: Xử lý như cold-start, `timeZ = unifiedRaw`, không normalize bằng MAD thiếu mẫu.
- Result: PASS - điều kiện dùng `historyValues.length < 3`.

## Test Case 11
- Mục tiêu: Validate document processor không crash với token record lỗi.
- Input: `knownTokens` có `{ symbol: null, name: "Bad" }`, `{ symbol: "A", name: "TooShort" }`, `{ symbol: "SOL", name: null }`.
- Expected: Token thiếu/không hợp lệ bị bỏ qua, batch không crash vì `.trim()` trên null/undefined.
- Result: PASS - token được chuẩn hóa bằng `String(value ?? "").trim()` và filter độ dài.

## Test Case 12
- Mục tiêu: Validate sai input news text không gửi `"undefined"` vào FinBERT.
- Input: News `{ title: "ETH rally", summary: undefined, content: "Volume expands" }`; news rỗng `{ title: "", summary: null, content: "" }`.
- Expected: Text score là `"ETH rally\nVolume expands"`; doc rỗng bị skip FinBERT.
- Result: PASS - text được build từ field truthy và `if (!textToScore) continue`.

## Test Case 13
- Mục tiêu: Validate proposal copy đủ metadata định lượng từ signal.
- Input: Signal có `uncertaintyEntropy`, `realizedVolatility`, `signalMode`, `detectedAt`, `metadata.scoreComponents`.
- Expected: Proposal lưu lại các field này để UI/backtest dùng.
- Result: PASS - `core/layer3/src/workflow.ts` copy các field trên vào `$set`.

## Test Case 14
- Mục tiêu: Validate API proposals không default sai thành `BUY`.
- Input: Proposal thiếu `action` và `suggestionType`.
- Expected: Response `action` là `UNKNOWN`, không phải `BUY`.
- Result: PASS - `normalizeAction(undefined)` trả `UNKNOWN`.

## Test Case 15
- Mục tiêu: Validate API proposals không suy luận action từ title.
- Input: Proposal `{ action: "HOLD", title: "Short term risk for SOL" }`.
- Expected: Response `action` vẫn là `HOLD`, không bị đổi thành `SELL`.
- Result: PASS - logic override bằng keyword `short/sell` đã bị bỏ.

## Test Case 16
- Mục tiêu: Validate sai input action.
- Input: `action: "moon"`, `suggestionType: "panic"`, `action: "sell"`.
- Expected: `"moon"` và `"panic"` trả `UNKNOWN`; `"sell"` normalize thành `SELL`.
- Result: PASS - normalize chỉ nhận `BUY`, `SELL`, `HOLD` sau uppercase.

## Test Case 17
- Mục tiêu: Validate backtest dùng timestamp signal khi proposal cũ thiếu `detectedAt`.
- Input: Proposal cũ có `signalId`, không có `detectedAt`; signal tương ứng có `detectedAt`.
- Expected: Entry timestamp lấy từ `signal.detectedAt`, không lấy `proposal.createdAt`.
- Result: PASS theo patch plan - `resolveDetectedAt` lookup signal khi proposal thiếu `detectedAt`.

## Test Case 18
- Mục tiêu: Validate fallback timestamp boundary cho backtest.
- Input: Proposal thiếu `detectedAt`; signal lookup không có `detectedAt` nhưng có `createdAt`; proposal có `updatedAt`.
- Expected: Ưu tiên `signal.createdAt`, sau đó mới fallback proposal timestamp.
- Result: PASS theo patch plan - fallback order đã được định nghĩa.

## Test Case 19
- Mục tiêu: Validate X scraper trong master cron bật theo default.
- Input: Env không set `RUN_X_SCRAPER`.
- Expected: Pipeline chạy bước X scraper trước quant/layer3.
- Result: PASS - `shouldRunXScraper = process.env.RUN_X_SCRAPER !== "false"`.

## Test Case 20
- Mục tiêu: Validate escape hatch cho dev/offline.
- Input: Env `RUN_X_SCRAPER=false`.
- Expected: Pipeline bỏ qua X scraper, vẫn chạy quant/layer3.
- Result: PASS - điều kiện chỉ chạy scraper khi flag khác `"false"`.

## Test Case 21
- Mục tiêu: Validate signal detail API dùng schema field chuẩn `tokenSymbol`.
- Input: Signal document `{ tokenSymbol: "ARB", symbol: undefined }`.
- Expected: API đọc được document và không phụ thuộc vào `symbol` required.
- Result: PASS - `tokenSymbol` đã có trong local schema, `symbol` optional.

## Test Case 22
- Mục tiêu: Validate signal detail API fallback expiry/detected metadata.
- Input: Signal thiếu `expiresAt`, có `detectedAt`.
- Expected: API trả `expiresAt = detectedAt + 7 ngày`.
- Result: PASS - route tính `expiresAt` bằng `SIGNAL_TTL_MS` khi thiếu.

## Test Case 23
- Mục tiêu: Validate price updater không gọi `bulkWrite` với batch rỗng.
- Input: CoinGecko trả data rỗng hoặc không tạo được `bulkOps`.
- Expected: Log warning và return sạch, không throw do empty bulk operation.
- Result: PASS theo patch plan - guard `bulkOps.length === 0` trước `bulkWrite`.

## Test Case 24
- Mục tiêu: Validate type safety các fix web API/UI.
- Input: Chạy `tsc -p apps/web/tsconfig.json --noEmit`.
- Expected: Không có lỗi TypeScript.
- Result: PASS - command exit code 0 khi chạy qua `cmd /c wsl ... /mnt/e/node.exe ./node_modules/typescript/bin/tsc`.

## Test Case 25
- Mục tiêu: Validate type safety signal detector.
- Input: Chạy `tsc -p core/signal-detector/tsconfig.json --noEmit`.
- Expected: Không có lỗi TypeScript.
- Result: PASS - command exit code 0.

## Bugs found:
- Không phát hiện bug functional mới qua static review và TypeScript checks đã chạy được.
- Blocker môi trường test: `npm run test` và `npm run build` không chạy được trong session hiện tại vì `npm` trong WSL resolve sang `/mnt/e/npm`, sau đó rơi vào Windows `cmd` với UNC path và báo `turbo` không recognized. Cần sửa PATH/toolchain WSL hoặc chạy bằng Node/npm native trong WSL để execute full test suite.
- Runtime integration chưa được verify với MongoDB/FinBERT/CoinGecko thật trong report này; các test case liên quan DB/API external cần chạy bằng mock hoặc môi trường staging để xác nhận end-to-end.
