# System Scale Risk Report

Nguồn phân tích: `PROJECT_CONTEXT.md`, `project_context.md`, `audit_report.md`.

Hệ thống hiện tại là pipeline Web3 signal analytics:

```text
Raw data -> Quant signal detection -> AI proposal reasoning -> Backtest/evaluation -> Web dashboard
```

Luồng scale nhạy cảm nhất:

```text
Twitter/News scrape
  -> FinBERT sentiment
  -> token detection
  -> z-score normalization
  -> aggregation per token
  -> signal upsert
  -> Layer3 proposal generation
  -> backtest/source weighting
  -> dashboard/API
```

## 1. Bottlenecks

### 1.1. FinBERT scoring becomes the first hard throughput ceiling

Scenario cụ thể:

- Cron chạy mỗi phút.
- Mỗi lần detector đọc 1.000 news/tweets trong 24h gần nhất.
- `processDocuments` gọi `finBertProbs(text)` cho mỗi text mới.
- Timeout thực tế trong `core/signal-detector/src/finbert.ts` là 40 giây, trong khi comment nói 10 giây.

Rủi ro khi scale:

- Chỉ cần 5% request FinBERT chậm hoặc retry là một batch có thể vượt quá chu kỳ cron 1 phút.
- Nếu DB lock trong `core/run/src/index.ts` giữ lâu, các lần chạy sau bị bỏ qua hoặc dồn hàng.
- Nếu lock không bao phủ toàn bộ module con, nhiều detector có thể tranh nhau ghi cùng token trong ngày.

Điểm nghẽn cụ thể:

- Latency phụ thuộc model/API bên ngoài.
- Cache hiện chỉ theo `textToScore`, không giải quyết được batch mới có nhiều title/summary khác nhau.
- News thiếu summary có thể bị score bằng `"Title\n"` hoặc `"undefined"`, vẫn tiêu tốn call nhưng chất lượng thấp.

Hậu quả vận hành:

- Dashboard nhìn như vẫn cập nhật vì `updatedAt` thay đổi, nhưng signal thực tế dựa trên dữ liệu cũ hoặc batch chưa xử lý xong.
- Token hot trong giờ biến động mạnh bị xử lý trễ sau vài phút đến vài chục phút, làm proposal mất ý nghĩa trading.

### 1.2. Cron mỗi phút tái xử lý dữ liệu 24h cũ thay vì xử lý delta sạch

Scenario cụ thể:

- 10:00 cron đọc news/tweets 24h, tạo signal `SOL`.
- 10:01 cron lại đọc cùng tập dữ liệu vì X scraper đang bị comment trong `core/run/src/index.ts`.
- `run-quant.ts` upsert theo `{ tokenSymbol, createdAt >= startOfDay }`.
- Cùng một signal trong ngày bị update lại, `status` bị set về `RAW`.

Rủi ro khi scale:

- Số token tăng từ 20 lên 500 làm detector phải group và normalize nhiều token không đổi mỗi phút.
- Proposal đã xử lý có thể bị reset sang `RAW`, Layer3 xử lý lại.
- LLM cost và quota tăng tuyến tính theo số lần reprocess, không theo số signal mới.

Hậu quả vận hành:

- Một signal tốt có thể sinh nhiều rationale khác nhau trong cùng ngày.
- Người dùng thấy proposal thay đổi nội dung mà không có raw event mới.
- Backtest ghi nhận nhiều proposal hoặc thời điểm entry lệch, làm win-rate giả.

### 1.3. MongoDB write path dễ thành bottleneck vì upsert coarse-grained theo token/ngày

Scenario cụ thể:

- Trong ngày có 40 tin về `BTC`, 25 tweet về `BTC`, và 3 đợt biến động khác nhau.
- Detector vẫn ghi về một document signal `BTC` của ngày đó.
- Layer3 đọc `status = RAW`, tạo proposal, rồi set `PROCESSED`.
- Lần detector sau update cùng document và reset status.

Rủi ro khi scale:

- Contention tập trung vào các token lớn như `BTC`, `ETH`, `SOL`.
- Intraday signal history bị mất vì các trạng thái 09:00, 12:30, 19:00 bị gộp vào một bản ghi.
- Không thể audit chính xác signal nào tạo ra proposal nào.

Hậu quả vận hành:

- Khi market đảo chiều trong cùng ngày, hệ thống có thể ghi đè signal bullish buổi sáng bằng bearish buổi tối.
- Proposal cũ vẫn còn rationale bullish, nhưng signal hiện tại đã bearish.
- Dashboard/API có thể hiển thị trạng thái không nhất quán giữa proposal và signal.

### 1.4. Source ingestion không đủ ổn định để tăng số account/source

Scenario cụ thể:

- X scraper xử lý account `cz_binance`.
- Batch 20 tweets fail insert vì một document thiếu `url` hoặc lỗi network/Mongo.
- `saveTweets` chỉ `console.error`, không throw fail.
- `lastTweetUpdatedAt` vẫn nhảy lên newest tweet.

Rủi ro khi scale:

- Khi số account tăng lên 500 KOL, xác suất một batch lỗi tăng mạnh.
- Một lỗi validation nhỏ có thể làm mất toàn bộ tweet trong batch.
- Vì checkpoint đã tiến lên, lần sau scraper bỏ qua các tweet chưa bao giờ lưu.

Hậu quả vận hành:

- Hệ thống thiếu chính xác những tweet quan trọng nhất trong lúc thị trường nóng.
- Quant layer không biết dữ liệu bị thủng, nên vẫn tính confidence như bình thường.
- Backtest về sau không phát hiện được missing raw data vì checkpoint làm lịch sử trông hợp lệ.

## 2. Failure Points

### 2.1. False token detection từ news có thể tạo signal sai hàng loạt

Scenario cụ thể:

- DB có token symbol `IN`.
- News scraper dùng regex với flag `"i"` cho toàn pattern.
- Bài viết có câu `"Bitcoin ETF inflows rose in May"`.
- Từ thường `"in"` bị match thành token `IN`.
- `core/signal-detector/src/document-processor.ts` tin tuyệt đối vào `detectedTokens`.

Failure chain:

```text
Regex false positive
  -> news detectedTokens sai
  -> FinBERT score gán cho token sai
  -> token aggregation tăng score sai
  -> Layer3 tạo proposal sai
  -> dashboard hiển thị BUY/SELL sai token
```

Rủi ro khi scale:

- Số token càng nhiều, càng có nhiều ticker trùng từ phổ biến: `IN`, `ON`, `ME`, `AI`, `ONE`, `TON`.
- Số article càng lớn, false-positive tích lũy thành tín hiệu có vẻ "có thống kê".
- Z-score có thể khuếch đại outlier sai nếu token ít dữ liệu thật.

Worst local impact:

- Một token nhỏ có ticker phổ biến nhận hàng chục article không liên quan trong ngày.
- Hệ thống tạo proposal với confidence cao vì news volume lớn, dù token không được nhắc thật.

### 2.2. Signal status lifecycle có race giữa quant và Layer3

Scenario cụ thể:

- 09:00 quant tạo signal `SOL`, `status = RAW`.
- 09:00:30 Layer3 tạo proposal và set signal `PROCESSED`.
- 09:01 quant chạy lại và upsert cùng document `SOL` hôm nay, set `status = RAW`.
- 09:01:30 Layer3 xử lý lại cùng signal.

Failure chain:

```text
Coarse upsert
  -> status reset
  -> duplicate Layer3 execution
  -> proposal overwritten
  -> audit trail mất tính quyết định
```

Rủi ro khi scale:

- Với nhiều token, thời gian Layer3 dài hơn, cửa sổ race rộng hơn.
- Nếu LLM chậm hoặc quota limit, một số signal bị reset nhiều lần trước khi xử lý xong.
- Proposal bị ghi đè làm người dùng không biết rationale nào là bản được sinh từ raw data nào.

### 2.3. Double-normalization làm quant score drift theo thời gian

Scenario cụ thể:

- Ngày 1 `ETH` có `unifiedRaw = 0.8`, sau alpha/cross thành `quantScore = 2.4`.
- `run-quant.ts` build `historicalData` từ `signals.quantScore`.
- `evaluateAlphaAndCross` lại coi `history[].unifiedRaw` là raw score trước chuẩn hóa.
- Ngày 2 current `unifiedRaw = 0.9` bị so với history `2.4`.

Failure chain:

```text
Final normalized score dùng làm raw history
  -> baseline sai
  -> timeZ sai dấu hoặc sai biên độ
  -> finalScore lệch
  -> source/backtest học trên score đã nhiễu
```

Rủi ro khi scale:

- Lỗi không crash, nên có thể tồn tại lâu.
- Càng nhiều ngày lịch sử, feedback loop càng khó debug.
- Backtest dynamic weighting có thể tăng weight cho source sai vì score đầu vào đã lệch.

### 2.4. NaN propagation có thể làm token biến mất khỏi signal silently

Scenario cụ thể:

- Một history record cũ thiếu `quantScore`.
- `historyValues` đã filter finite cho EMA.
- Nhưng `calcMAD(history.map(h => h.unifiedRaw))` chưa filter `NaN/null/undefined`.
- `mad7` thành `NaN`, `safeMad = Math.max(NaN, 0.01)` vẫn là `NaN`.
- `Math.abs(state.finalScore) > threshold` trả false.

Failure chain:

```text
Bad history value
  -> MAD NaN
  -> finalScore NaN
  -> threshold không pass
  -> token không sinh signal
```

Rủi ro khi scale:

- Khi migration/schema thay đổi, chỉ vài record lỗi cũng làm một nhóm token bị mất tín hiệu.
- Không có alert nếu token bị drop do NaN.
- Dashboard không phân biệt "không có signal" với "signal calculation failed".

### 2.5. Proposal API có thể default BUY sai khi thiếu field

Scenario cụ thể:

- Proposal cũ thiếu `action` và `suggestionType`.
- `apps/web/app/api/proposals/route.ts` default `action = "BUY"`.
- Title chứa `"SOL risk review"` hoặc text không đủ rõ.
- API list trả BUY dù quant không hề xác nhận BUY.

Failure chain:

```text
Missing proposal action
  -> API default BUY
  -> dashboard hiển thị thiên lệch bullish
  -> user hiểu sai risk
```

Rủi ro khi scale:

- Khi import/migrate proposal cũ, nhiều bản ghi thiếu field sẽ bị biến thành BUY.
- Nếu người dùng lọc theo BUY, dữ liệu lỗi lọt vào nhóm actionable.
- Điều này vi phạm rule cốt lõi: LLM/API không được thay quant ground truth.

## 3. Data Risks

### 3.1. Mất raw tweet vĩnh viễn do checkpoint cập nhật sau insert fail

Scenario cụ thể:

- Account có 20 tweet mới từ 10:00 đến 10:20.
- `insertMany` fail vì một tweet lỗi schema.
- Catch chỉ log `"DB FATAL ERROR"`.
- `lastTweetUpdatedAt` vẫn set thành 10:20.
- Lần scrape sau dùng cutoff 10:20.

Data risk:

- 20 tweet không tồn tại trong DB.
- Hệ thống không còn cơ chế tự scrape lại chúng.
- Signal ngày đó thiếu nguồn Twitter nhưng vẫn có thể được coi là clean.

Scale impact:

- Với 500 accounts, chỉ cần 1% batch fail/ngày là vài nghìn tweet mất vĩnh viễn mỗi tuần.
- KOL có engagement cao thường xuất hiện trong batch lớn lúc thị trường nóng; mất batch này làm authorWeight/engagement signal méo mạnh.

### 3.2. Token mapping sai gây data contamination giữa các asset

Scenario cụ thể:

- Ticker `AI` match vào bài news nói về artificial intelligence, không phải token `AI`.
- Bài có sentiment bullish vì tin công nghệ tích cực.
- Score được gán cho token `AI`.
- Backtest thấy token tăng ngẫu nhiên sau đó và tăng SiteWeight cho source.

Data risk:

- Raw news không liên quan bị ghi thành dữ liệu huấn luyện/đánh giá hợp lệ.
- SourceWeight/AuthorWeight có thể học nhầm từ contaminated label.
- Sau nhiều vòng backtest, hệ thống tự củng cố nguồn sai.

Scale impact:

- Khi thêm nhiều token low-cap có ticker ngắn, contamination tăng nhanh hơn tuyến tính.
- Một source news lớn có nhiều bài chung về thị trường có thể làm hàng chục token nhỏ cùng nhận sentiment giả.

### 3.3. Mất trường uncertainty/mode khi copy signal sang proposal

Scenario cụ thể:

- Signal `COLD_START` có `confidence = 0.35`, `uncertaintyEntropy = 0.98`, `signalMode = COLD_START`.
- `core/layer3/src/workflow.ts` chỉ copy `volatilityFlag` và `scoreComponents`.
- Proposal không có `uncertaintyEntropy`, `realizedVolatility`, `signalMode`.

Data risk:

- Layer người dùng đọc mất cảnh báo quan trọng nhất.
- UI phải fallback, có thể hiển thị proposal như tín hiệu bình thường.
- Report/backtest không tách được cold-start với normal signal.

Scale impact:

- Khi số token mới tăng, tỷ lệ cold-start tăng.
- Nếu proposal không giữ mode, hệ thống không thể đo riêng hiệu quả token mới.

### 3.4. Backtest entry time lệch khỏi detected time

Scenario cụ thể:

- Signal phát hiện lúc 09:00.
- Layer3 tạo proposal lúc 09:20 vì LLM queue chậm.
- Backtest dùng `proposal.detectedAt ?? proposal.createdAt ?? proposal.updatedAt`.
- Proposal schema không có `detectedAt`, Layer3 không copy `signal.detectedAt`.
- Entry price lấy quanh 09:20.

Data risk:

- PnL bỏ qua 20 phút đầu sau tín hiệu.
- Nếu giá pump ngay sau signal rồi đảo chiều trước proposal, backtest có thể đánh giá sai hoàn toàn.
- Hyperparameter optimization học từ entry không đúng thời điểm signal.

Scale impact:

- Khi Layer3 backlog tăng, độ trễ proposal tăng.
- Backtest càng ngày càng đo "LLM completion time" thay vì "signal detection time".

### 3.5. Schema drift giữa shared models và API local models

Scenario cụ thể:

- Shared signal schema dùng `tokenSymbol`.
- `apps/web/app/api/signals/[id]/route.ts` local `SignalSchema` yêu cầu `symbol`.
- Dev mới đọc type local và dùng `signal.symbol`.
- API trả `undefined` hoặc fallback sai.

Data risk:

- Dashboard detail và list có thể hiển thị khác nhau.
- Validation tương lai có thể reject document đúng schema shared.
- Những field mới như `signalMode`, `uncertaintyEntropy` dễ bị mất ở API boundary.

Scale impact:

- Khi nhiều endpoint, chart, report cùng tự định nghĩa schema, mỗi schema lệch sẽ tạo một version sự thật riêng.
- Người dùng không biết số liệu nào là từ quant chuẩn, số liệu nào là fallback frontend/API.

## 4. Worst-case Scenarios

### 4.1. False BUY cascade cho ticker ngắn trong ngày thị trường nóng

Trigger:

- Token `IN` hoặc `AI` tồn tại trong DB.
- News volume tăng mạnh vì Bitcoin ETF hoặc AI market narrative.
- Regex token matcher match từ thường như `"in"` hoặc `"AI"` context ngoài crypto.

Diễn biến:

1. News scraper lưu nhiều article với `detectedTokens` sai.
2. Detector score FinBERT các article này là bullish.
3. Token nhỏ có ít dữ liệu thật, nên z-score bị đẩy thành outlier.
4. Quant tạo signal mạnh.
5. Layer3 sinh rationale có vẻ hợp lý dựa trên raw news không liên quan.
6. Proposal API/UI có thể default hoặc hiển thị BUY.

Kết quả xấu nhất:

- User nhận BUY proposal cho token không hề được thị trường nhắc đến.
- Backtest sau đó có thể tình cờ thấy giá tăng và tăng weight cho nguồn sai.
- Hệ thống biến false-positive thành learned behavior.

System lesson:

- Đây là risk contamination, không chỉ là bug matching.
- Khi scale số token, false-positive có thể trở thành nguồn alpha giả.

### 4.2. Reprocessing loop làm proposal liên tục bị ghi đè trong lúc LLM chậm

Trigger:

- Gemini hoặc Layer3 chậm do quota/latency.
- Cron quant vẫn chạy mỗi phút.
- Upsert signal theo token/ngày reset `status = RAW`.

Diễn biến:

1. 09:00 signal `SOL` được tạo.
2. 09:01 Layer3 chưa xong, quant reset hoặc update cùng signal.
3. 09:02 Layer3 xong proposal A.
4. 09:03 quant reset `status = RAW`.
5. 09:04 Layer3 tạo proposal B, overwrite proposal A.
6. Các proposal có `updatedAt` mới nhưng raw source không đổi.

Kết quả xấu nhất:

- LLM cost tăng không kiểm soát.
- Audit không trả lời được proposal nào là bản đầu tiên.
- User thấy recommendation thay đổi wording hoặc action mà không có market event mới.

System lesson:

- Status lifecycle hiện tại chưa idempotent theo signal event.
- Scale cần event identity riêng, không thể dùng token/ngày làm khóa xử lý.

### 4.3. Silent data loss trong X scraper làm hệ thống bullish giả

Trigger:

- Một KOL lớn đăng thread bearish.
- Batch insert fail vì một tweet lỗi schema hoặc Mongo hiccup.
- Checkpoint vẫn cập nhật.

Diễn biến:

1. Tweet bearish không được lưu.
2. News cùng ngày bullish vẫn vào DB.
3. Aggregation thiếu Twitter negative evidence.
4. Quant score nghiêng bullish.
5. Proposal giải thích theo news bullish.
6. Backtest không biết Twitter input bị mất.

Kết quả xấu nhất:

- Hệ thống ra BUY trong khi nguồn Twitter trọng yếu đang bearish.
- Vì raw tweet không có trong DB, reviewer không thể tái hiện lỗi nếu chỉ nhìn data hiện tại.
- Nếu xảy ra với nhiều account, toàn bộ Twitter_Score bị lệch mà không có alert.

System lesson:

- Checkpoint là data correctness boundary.
- Không được advance checkpoint nếu persistence chưa chắc chắn thành công.

### 4.4. Backtest chọn sai hyperparameter vì entry timestamp bị trễ

Trigger:

- Market biến động nhanh.
- Layer3 queue trễ 20-60 phút.
- Proposal không có `detectedAt`.

Diễn biến:

1. Signal phát hiện `ETH` lúc 09:00 khi giá 3.000.
2. Giá lên 3.120 lúc 09:10.
3. Proposal tạo lúc 09:25 khi giá 3.110.
4. Backtest entry ở 09:25 thay vì 09:00.
5. PnL chỉ tính phần sau, không đo được alpha thật của quant.

Kết quả xấu nhất:

- Một strategy tốt bị đánh giá thấp vì bỏ qua move đầu.
- Một strategy xấu có thể được đánh giá cao nếu entry trễ né được drawdown.
- Dynamic SiteWeight/AuthorWeight cập nhật theo metric sai.

System lesson:

- Backtest phải dùng thời điểm signal detection, không dùng thời điểm proposal creation.
- Khi scale Layer3, độ trễ không còn là noise nhỏ.

### 4.5. NaN history làm token quan trọng biến mất khỏi dashboard

Trigger:

- Migration cũ tạo một signal thiếu `quantScore`.
- Token đó có lịch sử mixed valid/invalid.
- MAD calculation nhận `undefined`.

Diễn biến:

1. Detector build history cho token.
2. EMA dùng finite values, nên không crash.
3. MAD thành `NaN`.
4. `finalScore` thành `NaN`.
5. Threshold check fail silently.
6. Không có signal mới cho token.

Kết quả xấu nhất:

- Token đang có event thật nhưng dashboard không hiện gì.
- Operator hiểu nhầm là hệ thống không thấy cơ hội/rủi ro.
- Vì không có exception, monitoring job-level vẫn báo success.

System lesson:

- Silent invalid numeric state nguy hiểm hơn crash.
- Quant pipeline cần invariant: mọi score ghi DB phải finite hoặc có explicit failure record.

## 5. System Limits

### 5.1. Limit hiện tại của event identity

Giới hạn:

- Signal identity đang gần với `tokenSymbol + day`.
- Không đủ để biểu diễn nhiều signal intraday cho cùng token.

Scenario vượt giới hạn:

- `BTC` có bearish news lúc 08:00, bullish ETF inflow lúc 12:00, bearish exploit rumor lúc 18:00.
- Hệ thống chỉ giữ một signal document trong ngày.

Hậu quả:

- Không thể replay chính xác.
- Không thể backtest từng event.
- Không thể đảm bảo Layer3 idempotent.

Scale threshold thực tế:

- Khi mỗi token có hơn 1 market-moving event/ngày, khóa token/ngày bắt đầu mất dữ liệu nghiệp vụ.

### 5.2. Limit hiện tại của normalization history

Giới hạn:

- Z-score/timeZ phụ thuộc lịch sử đúng loại raw score.
- Audit cho thấy history đang lấy từ `quantScore`, không phải raw `unifiedRaw`.

Scenario vượt giới hạn:

- Sau 30 ngày, history chứa score đã qua nhiều lớp normalization.
- Current raw score bị so với final score cũ.

Hậu quả:

- Score drift.
- Threshold không còn ý nghĩa ổn định.
- Backtest không còn đo cùng một đại lượng qua thời gian.

Scale threshold thực tế:

- Khi hệ thống bắt đầu dùng dynamic weighting/backtest tự học, lỗi baseline sẽ ảnh hưởng toàn bộ model selection.

### 5.3. Limit hiện tại của ingestion reliability

Giới hạn:

- X scraper có thể advance checkpoint dù insert fail.
- News token detection có false-positive.
- X scraper đang bị comment trong master cron.

Scenario vượt giới hạn:

- Thêm 100-500 KOL accounts và 20 news sources.
- Một phần dữ liệu không vào DB, một phần vào sai token.
- Quant vẫn chạy bình thường.

Hậu quả:

- Data completeness không đo được.
- Data correctness không đo được.
- Signal confidence không phản ánh chất lượng input.

Scale threshold thực tế:

- Khi raw volume đủ lớn để manual review không còn khả thi, ingestion phải có retry, dead-letter, checkpoint atomicity và quality metrics.

### 5.4. Limit hiện tại của Layer3 coupling

Giới hạn:

- Proposal generation phụ thuộc signal status `RAW/PROCESSED`.
- Proposal không copy đầy đủ signal metadata.
- LLM latency ảnh hưởng backtest timestamp nếu proposal time được dùng làm fallback.

Scenario vượt giới hạn:

- 200 signals/ngày, mỗi proposal mất 5-20 giây hoặc bị rate limit.
- Queue Layer3 trễ 30 phút.

Hậu quả:

- Proposal không còn realtime.
- Backtest entry time lệch.
- Signal uncertainty/mode mất ở layer người dùng.

Scale threshold thực tế:

- Khi Layer3 không xử lý xong trước lần quant tiếp theo, trạng thái `RAW/PROCESSED` không đủ làm queue protocol.

### 5.5. Limit hiện tại của API/dashboard truth boundary

Giới hạn:

- API proposal có fallback `BUY`.
- API signal detail có schema local lệch `symbol`/`tokenSymbol`.
- UI có thể phải fallback khi proposal thiếu field.

Scenario vượt giới hạn:

- Migration hoặc Layer3 lỗi tạo 1.000 proposal thiếu `action`.
- Dashboard list default nhiều proposal thành BUY.

Hậu quả:

- Người dùng thấy recommendation sai hướng.
- Filter/action analytics bị lệch.
- Quant ground truth bị override bởi presentation layer.

Scale threshold thực tế:

- Khi proposal là bề mặt ra quyết định cho nhiều người dùng, API không được tự suy luận action nếu quant/proposal không có field hợp lệ.

## Priority Risk Summary

| Priority | Risk | Concrete failure |
| --- | --- | --- |
| P0 | Token false-positive contamination | Ticker ngắn như `IN`, `AI` nhận news không liên quan và sinh BUY/SELL sai |
| P0 | Signal status reset loop | Quant mỗi phút reset `PROCESSED` về `RAW`, Layer3 xử lý lại và overwrite proposal |
| P0 | X scraper silent data loss | Insert fail nhưng checkpoint vẫn advance, mất tweet vĩnh viễn |
| P1 | Double-normalization | `quantScore` cũ bị dùng như raw history, làm z-score/timeZ sai |
| P1 | Backtest timestamp lệch | Entry price lấy theo proposal creation thay vì signal detection |
| P1 | NaN silent drop | Token có history lỗi biến mất khỏi signal mà job vẫn success |
| P2 | Proposal metadata loss | Cold-start/uncertainty không tới UI, user không thấy risk mode |
| P2 | API default BUY | Proposal thiếu action bị hiển thị BUY |

## Scale Readiness Verdict

Hệ thống chưa sẵn sàng scale theo nghĩa production signal engine.

Lý do không nằm ở thiếu module, mà ở các boundary chưa đủ chặt:

- Ingestion chưa bảo toàn dữ liệu khi lỗi.
- Token detection có thể contaminate label.
- Signal identity chưa biểu diễn được intraday event.
- Quant history đang có nguy cơ dùng sai đại lượng.
- Layer3 queue/status chưa idempotent.
- Backtest có thể học từ timestamp sai.
- API có fallback làm sai ground truth.

Nếu tăng số token, số nguồn, số account hoặc tần suất cron ngay bây giờ, rủi ro lớn nhất không phải là hệ thống crash. Rủi ro lớn nhất là hệ thống vẫn chạy, vẫn sinh proposal, nhưng proposal được tạo từ dữ liệu sai, thiếu hoặc bị ghi đè mà không có dấu hiệu cảnh báo rõ ràng.
