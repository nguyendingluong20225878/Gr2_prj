# Đề xuất nâng cấp GR2 thành near real-time và dynamic backtesting trong phạm vi ĐATN

## 1. Tổng quan vấn đề

GR2 hiện là hệ thống Web3 signal analytics và trading decision theo pipeline:

```text
X / News / Token price
  -> MongoDB raw collections
  -> core/signal-detector Quant V3
  -> signals
  -> core/layer3 Gemini reasoning
  -> proposals
  -> core/research/backtest
  -> apps/web dashboard
```

Vì đây là ĐATN sinh viên, mục tiêu phù hợp không phải là xây một hệ thống trading realtime production như quỹ định lượng, mà là chứng minh được một kiến trúc có tính tự động, có cơ sở định lượng, có khả năng mở rộng, và có thể giải thích được cho người dùng. Do đó, hướng thiết kế hợp lý là giữ kiến trúc hiện tại làm lõi, nâng cấp theo hướng near real-time, dynamic backtesting và explainability. Các thành phần streaming/online learning phức tạp nên được trình bày như hướng mở rộng hoặc mô phỏng ở mức đơn giản, không nên biến thành phạm vi triển khai bắt buộc.

Mục tiêu nâng cấp không nên là viết lại toàn bộ. Nền tảng hiện tại đã có nhiều phần đúng: scoring có time decay, entropy, volume boost, time-series Z, beta-to-BTC neutralization, cross-sectional Z, confidence penalty cho cold start, backtest PnL có phí/slippage/drawdown, và optimizer đã có replay snapshot cho hyperparameter candidates.

Vấn đề chính là các phần này đang vận hành theo batch, chủ yếu dùng cấu hình active tĩnh. Hệ thống chưa có event stream, chưa lưu đầy đủ feature snapshot để backtest tái lập hoàn toàn, chưa có rolling/adaptive weight theo regime, và UI vẫn pull API định kỳ nên cảm giác realtime còn yếu.

Trong phạm vi ĐATN, có thể định vị hệ thống là:

```text
Near real-time AI trading signal system
  = batch ngắn theo cron
  + dashboard polling/refresh nhanh
  + Quant scoring tự động
  + AI explanation
  + dynamic backtest theo nhiều bộ trọng số
```

Như vậy, hệ thống vẫn đáp ứng mục tiêu "realtime" ở mức near real-time, nhưng tránh over-engineering như Kafka cluster, distributed stream processing, online reinforcement learning thật, hoặc trading execution bằng tiền thật.

### Phạm vi phù hợp cho ĐATN

Nên triển khai thật:

- Cron pipeline 1-5 phút.
- MongoDB làm source of truth.
- Quant V3 hiện tại làm baseline scoring.
- Backtest động bằng grid search / rolling window.
- Rolling beta/correlation với BTC ở mức đơn giản.
- Dashboard polling 30 giây hoặc manual refresh.
- Explainability bằng score components và Gemini rationale.

Nên trình bày như hướng mở rộng:

- Kafka/Redpanda full streaming.
- Redis Streams production consumer group.
- WebSocket realtime push.
- Online learning phức tạp.
- Reinforcement learning.
- Genetic algorithm quy mô lớn.
- Microservice hóa toàn bộ hệ thống.

## 2. Đánh giá hiện trạng

### 2.1 Batch hay realtime?

Hiện tại là near-batch. Với tiêu chuẩn production thì chưa phải realtime/streaming, nhưng với phạm vi ĐATN có thể định nghĩa hợp lý là near real-time vì pipeline chạy tự động theo chu kỳ ngắn và UI cập nhật định kỳ.

- `core/run/src/index.ts` chạy cron mỗi 1 phút, dùng lock `job_locks` để tránh overlap.
- Trong mỗi cron, pipeline gọi script bằng `execSync`: X scraper nếu bật, sau đó `run-quant.ts`, rồi `run-layer3.ts`.
- `run-quant.ts` đọc news/tweets trong 24 giờ gần nhất, token list, x_accounts, lịch sử signal 7 ngày, chạy Quant V3 rồi bulk upsert vào `signals`.
- `run-layer3Batch` đọc `signals(status = RAW)`, xử lý theo `limit`, mỗi signal delay mặc định 15 giây để gọi Gemini.
- Frontend `useSignals` fetch `/api/signals` rồi polling mỗi 30 giây.

Kết luận: latency tốt nhất phụ thuộc chu kỳ cron + thời gian FinBERT + bulk write + delay Layer3 + polling UI. Đây là batch micro-window, không phải event-driven. Tuy nhiên đây là lựa chọn phù hợp cho ĐATN vì đơn giản, dễ demo, dễ kiểm soát lỗi và không cần hạ tầng streaming phức tạp.

### 2.2 Static hay dynamic?

Hệ thống đang semi-static.

- Các tham số mặc định nằm trong `DEFAULT_HYPER_PARAMS`: `tweetHalfLifeHours`, `newsHalfLifeHours`, `maxWeightPerUser`, `newsBaseWeight`, `betaToBtc`, `alphaBlend`, `signalThreshold`, `actionThreshold`, `confidenceDivisor`.
- Runtime có thể load active config từ `hyperparameter_configs` qua `loadActiveHyperParams("production")`.
- Backtest optimizer có grid/replay và có thể lưu/promote candidate.
- Tuy nhiên active config chỉ đổi khi chạy optimizer/promote. Chưa có cơ chế tự động cập nhật theo rolling window, market regime, hoặc feedback gần nhất.
- `source_weights` và `signal_weights` đã có schema cho IC/rolling weight, nhưng runtime mới dùng `source_weights.siteWeight` cho news; chưa thấy integration đầy đủ cho Twitter vs News dynamic blend.

Kết luận: logic scoring có thành phần động theo dữ liệu mới, nhưng trọng số chính vẫn là static/periodically promoted, chưa time-adaptive. Với ĐATN, mức cải tiến phù hợp là thêm dynamic backtest để chọn bộ trọng số tốt hơn theo rolling window, chưa cần tự động học online liên tục.

### 2.3 Bottleneck chính

Data pipeline:

- X scraper dùng Selenium và chạy tuần tự theo cron, dễ chậm và phụ thuộc credential/session.
- News scraper có RSS/HTML/Firecrawl fallback, concurrency có giới hạn, nhưng vẫn là crawl theo batch.
- Price fetcher dùng CoinGecko current/historical API; price history có thể sparse nên backtest phải fallback hoặc skip.
- Raw event chưa có queue/event id/idempotency trạng thái xử lý theo từng document. Quant đang đọc lại window 24 giờ và tính lại nhiều phần.

Signal generation:

- `processDocuments` gọi FinBERT theo document text, có cache in-memory trong một lần chạy nhưng chưa persistent cache.
- Token matching quét tất cả known tokens qua regex cho từng document; càng nhiều token càng tốn CPU.
- Aggregation recompute toàn bộ window 24 giờ thay vì cập nhật incremental khi có tweet/news mới.
- Layer3 chậm do LLM call, batch limit và delay 15 giây/signal.

Scoring logic:

- `betaToBtc` là hằng số, chưa phải rolling beta/correlation thật.
- `alphaBlend` là hằng số, chưa đổi theo regime.
- Cross-sectional Z chỉ ổn khi có đủ token có lịch sử; cold start đang giảm rủi ro bằng confidence cap nhưng vẫn dễ nhiễu.
- Regime trên UI hiện chỉ dựa vào breadth BUY/total, chưa dựa vào volatility/correlation/market return.

Database/API latency:

- `/api/signals` có thể query không giới hạn nếu không truyền `limit`.
- API enrich signals bằng query proposals theo signal ids, tốt hơn N+1 nhưng vẫn trả payload đầy đủ cho dashboard.
- UI polling 30 giây gây delay cảm nhận và tải lặp.
- MongoDB hiện là operational store cho cả raw, feature, signal, proposal, backtest. Chưa có read model/cache riêng cho realtime dashboard.

## 3. Giải pháp chi tiết từng phần

### 3.1 Realtime / near realtime architecture

Với ĐATN, nên chia realtime thành hai mức: mức triển khai thực tế trong đồ án và mức mở rộng nếu hệ thống đi lên production.

Mức nên triển khai trong ĐATN:

```text
Scraper / Price Fetcher
  -> MongoDB
  -> Cron Quant Detector mỗi 1-5 phút
  -> signals
  -> Layer3 AI Proposal chạy async/batch nhỏ
  -> Backtest Job định kỳ
  -> Next.js API
  -> Dashboard polling 30 giây
```

Mức mở rộng sau ĐATN:

```text
Ingestion services
  -> raw_events stream
  -> feature workers
  -> token_state store
  -> scoring worker
  -> signal_events stream
  -> Layer3 async worker
  -> WebSocket/SSE API
  -> dashboard
```

Luồng chi tiết theo hướng streaming mở rộng:

```text
X scraper / News scraper / Price fetcher
  -> publish event: tweet.created, news.created, price.updated
  -> Redis Stream hoặc Kafka topic
  -> document scorer:
       token detection
       FinBERT sentiment
       entropy
       source weight
       decay-aware feature
       persistent text_score_cache
  -> feature store:
       evidence_features
       token_feature_state
  -> signal scorer:
       update affected token only
       recompute rolling metrics for token
       emit signal.created / signal.updated
  -> Layer3 worker:
       generate rationale async only for high-priority/actionable signal
  -> API:
       query latest read model
       push delta to UI via SSE/WebSocket
```

Recommended technology:

- ĐATN nên dùng: Node.js/TypeScript, MongoDB, cron, Next.js API, dashboard polling.
- Có thể thêm nếu kịp: Redis cache hoặc in-memory cache cho latest signals.
- Nêu trong thiết kế mở rộng: Redis Streams + BullMQ hoặc plain consumer groups.
- Chỉ nên nêu như future work: Kafka/Redpanda khi volume lớn, cần replay nhiều topic, nhiều consumer group và retention dài.
- Push UI: trong ĐATN giữ polling; SSE/WebSocket là hướng mở rộng. Nếu muốn demo realtime đẹp hơn thì SSE đơn giản hơn WebSocket vì dashboard chủ yếu nhận stream một chiều.
- DB: MongoDB tiếp tục là source of truth; thêm collections/read models thay vì thay DB ngay.

### 3.2 Giảm latency

Quick wins không phá logic hiện tại:

1. Giới hạn API mặc định `/api/signals?limit=100`, thêm cursor theo `detectedAt/_id`.
2. Thêm cache đơn giản cho `/api/signals` latest payload. Trong ĐATN có thể dùng in-memory cache hoặc MongoDB read model; Redis là tùy chọn nếu còn thời gian.
3. Tách Quant và Layer3: signal phải xuất hiện ngay sau Quant, rationale có thể cập nhật sau.
4. Persistent FinBERT cache:

```text
sentiment_cache {
  textHash,
  modelName,
  pPos,
  pNeg,
  pNeu,
  createdAt
}
```

5. Incremental scoring theo affected token là hướng tốt, nhưng trong ĐATN có thể triển khai bản nhẹ: vẫn chạy cron, nhưng chỉ query dữ liệu mới hoặc giới hạn window nhỏ hơn thay vì recompute quá rộng.

```text
new tweet/news mentions SOL
  -> only update SOL evidence window
  -> update BTC state if needed
  -> update cross-section summary cache
  -> write latest SOL signal
```

6. Precompute read model nếu dashboard chậm. Nếu chưa chậm, có thể chỉ trình bày như cải tiến tương lai:

```text
signal_feed_read_model {
  signalId,
  tokenSymbol,
  action,
  quantScore,
  confidence,
  decisionState,
  backtestLabel,
  rationalePreview,
  scoreComponents,
  updatedAt
}
```

### 3.3 Offline computation vs online inference

Offline jobs:

- Backfill price history.
- Recompute source IC and `source_weights`.
- Rolling correlation/beta/regime estimation.
- Hyperparameter optimization.
- Model validation and promotion.
- Heavy LLM batch enrichment for low-priority signals.

Online path:

- Accept new raw event.
- Score document.
- Update token state and signal.
- Use latest active/adaptive config.
- Push signal delta to UI within seconds.
- Queue Layer3 explanation asynchronously.

Rule of thumb:

```text
Online: small, incremental, deterministic, explainable, idempotent.
Offline: expensive, historical, optimizer-driven, can run minutes/hours.
```

## 4. Dynamic backtesting

### 4.1 Hiện trạng trọng số cố định

Trọng số chính hiện gồm:

- Document recency: `tweetHalfLifeHours`, `newsHalfLifeHours`.
- Tweet author cap: `maxWeightPerUser`.
- News base/source weight: `newsBaseWeight * siteWeight`.
- Market neutralization: `betaToBtc`.
- Final score blend: `alphaBlend * pureAlphaZ + (1 - alphaBlend) * crossZ`.
- Threshold: `signalThreshold`, `actionThreshold`.
- Confidence divisor/cold start divisor.

Điểm tốt:

- Có half-life, entropy, robust MAD/EMA, cold-start penalty.
- Có schema và service cho `hyperparameter_configs`.
- Có replay engine để chạy lại detector theo historical snapshots.

Vấn đề:

- Nếu config active không đổi, hệ thống bị lag khi regime đổi.
- `betaToBtc` cố định dễ sai khi altcoin correlation với BTC thay đổi.
- `alphaBlend` cố định có thể overfit một giai đoạn.
- Grid search đơn giản dễ tốn compute, dễ overfit nếu không walk-forward validation.
- Proposal backtest sau khi signal đã tạo không đủ để đánh giá config mới; đúng hướng là replay raw snapshots, và repo đã bắt đầu làm điều này trong `replay-engine.ts`.

### 4.2 Backtest engine động nên có gì

Đây là phần quan trọng nhất và cũng là phần nên ưu tiên triển khai thật trong ĐATN. Không cần xây optimizer quá phức tạp; chỉ cần chứng minh hệ thống có thể chạy lại lịch sử với nhiều bộ trọng số, so sánh kết quả, chọn candidate tốt hơn và lưu lại cấu hình.

Cần mở rộng từ replay hiện tại thành backtest engine có 4 lớp:

```text
1. Historical snapshot builder
   raw tweet/news/price -> asOf snapshots

2. Candidate signal replay
   detector(candidateConfig, asOf) -> virtual signals

3. Portfolio/PnL evaluator
   entry/exit price + fees + slippage + sizing + risk rules -> metrics

4. Optimizer/promoter
   rank candidates -> validate out-of-sample -> promote or reject
```

Thêm collections nên có:

```text
backtest_runs
  runId, type, trainWindow, validationWindow, optimizer, status, startedAt, endedAt

backtest_candidates
  runId, candidateId, params, regime, metrics, objectiveScore, promoted
```

Nếu còn thời gian, có thể thêm:

```text
feature_snapshots
  asOf, tokenSymbol, unifiedRaw, docsCount, avgEntropy, sourceBreakdown,
  sourceScores, scoreInputsHash

adaptive_weight_history
  effectiveFrom, effectiveTo, regime, params, reason, metrics
```

Điểm quan trọng: backtest động phải dùng dữ liệu tại thời điểm quá khứ, không được nhìn tương lai. Mọi feature dùng ở `asOf` chỉ được lấy từ `timestamp <= asOf`; giá exit chỉ dùng ở bước evaluate outcome.

### 4.3 Dynamic weighting theo thời gian

Đề xuất phù hợp ĐATN là rolling walk-forward đơn giản:

```text
Mỗi ngày hoặc mỗi 6 giờ:
  trainWindow = 21-60 ngày trước validation
  validationWindow = 3-7 ngày gần nhất đã đủ horizon
  candidates = grid/Bayesian/GA
  replay raw snapshots theo stepHours
  đánh giá PnL, win rate, drawdown, turnover, sample count
  promote nếu vượt guardrails
```

Guardrails promotion:

- `evaluated >= minTrades`, ví dụ 50.
- `validation.totalPnL > 0`.
- `validation.winRate >= baseline + margin`.
- `maxDrawdownUsd <= threshold`.
- Không đổi config quá mạnh: giới hạn delta mỗi lần promote.
- So sánh với current active config trên cùng validation window.

Trong bản ĐATN, không nhất thiết phải auto-promote config. Có thể dừng ở mức:

```text
Chạy optimizer
  -> sinh danh sách candidate
  -> chọn best candidate theo objectiveScore
  -> lưu vào hyperparameter_configs với status CANDIDATE
  -> hiển thị/ghi báo cáo so sánh với config hiện tại
```

Auto-promote sang `ACTIVE` có thể là tùy chọn demo hoặc hướng phát triển.

Adaptive config runtime:

```text
effectiveParams = blend(activeParams, regimeParams, onlineCorrection)
```

Ví dụ:

- Regime risk-on: tăng trọng số cross-sectional alpha, giảm threshold một chút nếu win-rate gần đây tốt.
- Regime defensive/high-correlation: tăng action threshold, tăng penalty entropy, tăng beta/correlation neutralization.
- Sparse data: giảm confidence, chỉ HOLD nếu sample size thấp.

### 4.4 Adaptive model

Nên đi từ đơn giản đến phức tạp. Với ĐATN, mức 1 là đủ mạnh nếu triển khai tốt; các mức sau nên trình bày như định hướng nghiên cứu mở rộng:

1. Rolling IC update, nên triển khai nếu kịp:
   - Tính correlation giữa score component và forward return.
   - Cập nhật `source_weights` và `signal_weights`.

2. Bayesian update, hướng mở rộng:
   - Mỗi source/model có prior reliability.
   - Khi outcome xảy ra, update posterior reliability.
   - Dùng posterior mean để scale weight.

3. Contextual bandit, hướng mở rộng:
   - Context: regime, volatility, entropy, sample size, token liquidity, source mix.
   - Action: chọn weight set hoặc threshold.
   - Reward: risk-adjusted PnL sau horizon.

4. Online learning, không nên bắt buộc trong ĐATN:
   - Logistic/linear model dự đoán probability of positive forward return.
   - Feature gồm `timeZ`, `pureAlphaZ`, `crossZ`, entropy, source mix, rolling beta, rolling volatility.
   - Chỉ dùng để calibrate confidence/threshold trước, không thay thế quant rule ngay.

Reinforcement learning chỉ nên dùng sau khi có simulator tốt, transaction cost model, position sizing và đủ dữ liệu. Giai đoạn đầu, rolling/Bayesian/contextual bandit an toàn và explainable hơn.

### 4.5 Tối ưu search

Hiện có grid:

```text
alphaBlend: 0.5..0.9
signalThreshold: 0.3..1.0
actionThreshold: 1.0..2.0
tweetHalfLife: 2..12h
newsHalfLife: 12..48h
```

Nâng cấp theo mức phù hợp:

- Nên làm trong ĐATN: Grid search cho baseline, nhỏ và dễ explain.
- Có thể nêu trong báo cáo: Bayesian optimization cho tham số liên tục khi replay đắt.
- Chỉ nên là future work: Genetic algorithm nếu số rule/weights nhiều.
- Multi-objective scoring:

```text
objective =
  pnlWeight * totalPnL
  + winRateWeight * winRate
  + sharpeWeight * sharpe
  - drawdownWeight * maxDrawdown
  - turnoverWeight * turnover
  - instabilityWeight * parameterDelta
```

Nên thêm Sharpe/Sortino, profit factor, average win/loss, exposure, turnover, per-regime metrics.

## 5. Correlation

### 5.1 Vấn đề hiện tại

Hiện tại hệ thống dùng `betaToBtc` cố định để neutralize token so với BTC:

```text
pureAlphaZ = timeZ - betaToBtc * btcTimeZ
```

Đây là approximation tốt để bắt đầu, nhưng không phải rolling correlation/beta thật. Khi thị trường đổi regime, beta của SOL/ETH/meme token với BTC có thể thay đổi mạnh. Nếu vẫn dùng `0.75`, signal có thể bị under-hedge hoặc over-neutralize.

Regime UI hiện dựa trên breadth BUY/total. Đây là view hữu ích cho user, nhưng chưa đủ để drive scoring.

### 5.2 Đề xuất rolling correlation

Trong ĐATN, correlation nên triển khai ở mức rolling correlation/rolling beta với BTC. Đây là mức vừa đủ có ý nghĩa định lượng, dễ giải thích và không làm hệ thống quá phức tạp.

Tạo job offline/nearline tính rolling return correlation:

```text
rolling_metrics {
  tokenSymbol,
  windowHours,
  asOf,
  returnVol,
  corrToBtc,
  betaToBtc,
  corrToEth,
  marketRegime,
  sampleCount
}
```

Công thức beta:

```text
beta(token, BTC) = cov(return_token, return_btc) / var(return_btc)
```

Window đề xuất:

- 6h/24h cho near-real-time risk.
- 7d/30d cho stable regime.

### 5.3 Weighted correlation

Weighted correlation là hướng nâng cao. Nếu không đủ thời gian, chỉ cần rolling correlation thường là đủ cho ĐATN. Nếu muốn tăng điểm học thuật, có thể trình bày weighted correlation như công thức mở rộng:

```text
w_t = exp(-lambda * ageHours)
weightedCorr = weightedCov(x, y) / sqrt(weightedVar(x) * weightedVar(y))
```

Dùng weighted beta trong scoring:

```text
dynamicBeta = clamp(rollingBetaToBtc, 0, 2)
pureAlphaZ = timeZ - dynamicBeta * btcTimeZ
```

### 5.4 Regime-based correlation

Regime-based correlation nên được trình bày ở mức rule-based, không cần model phức tạp. Phân regime:

```text
Risk-on:
  BTC return > 0, market breadth cao, volatility vừa/thấp

Defensive:
  BTC return < 0 hoặc drawdown cao, stablecoin/major dominance tăng

High-correlation stress:
  avg corrToBtc cao, volatility cao, dispersion thấp

Mixed/rotation:
  breadth trung bình, dispersion cao
```

Integrate vào scoring:

```text
if regime == "high_correlation_stress":
  actionThreshold += 0.3
  alphaBlend += 0.1
  confidence *= 0.85
  require sampleSize higher

if regime == "rotation":
  increase crossZ contribution

if regime == "risk_on":
  allow lower actionThreshold only if backtest validation positive
```

## 6. Phù hợp user flow

### 6.1 User flow hiện tại

Người dùng đi qua:

```text
Overview
  -> xem Market Regime, decision queue, strongest/risk/expiring signals
  -> Signals page
  -> lọc Ready / Validation / Risk / Wait
  -> mở chi tiết signal/proposal
  -> xem confidence, rationale, backtest, source
```

Điểm tốt:

- UI đã có confidence, decision state, health, backtest label, layer conflict, source count, score components.
- Quant và Layer3 được phân biệt qua layer2/layer3 action.

Pain points:

- Polling 30 giây nên user không thấy tín hiệu mới ngay.
- Rationale Layer3 có thể đến chậm; nếu UI chỉ chờ proposal thì người dùng cảm giác delay.
- Confidence hiện là điểm scalar nhưng chưa giải thích rõ vì sao tăng/giảm.
- Backtest result là outcome từng proposal, chưa có "model hiện tại đang thắng/thua trong regime này".
- Regime chưa đủ định lượng nên user khó trust khi thị trường biến động mạnh.

### 6.2 UI/UX logic đề xuất

Dashboard nên tách signal lifecycle:

```text
SCORING -> SIGNAL_READY -> EXPLANATION_PENDING -> EXPLAINED -> BACKTEST_PENDING -> BACKTESTED
```

Hiển thị:

- "Quant ready" ngay khi có signal.
- "AI explanation pending" nếu Layer3 chưa xong.
- Confidence breakdown:

```text
Confidence 62%
  + strong timeZ
  + source weight high
  - entropy high
  - sample size low
  - regime stress
```

- Score component chips: `unifiedRaw`, `timeZ`, `pureAlphaZ`, `crossZ`, `dynamicBeta`, `entropy`, `sourceMix`.
- Model health panel:

```text
Current model:
  active config version
  validation win rate
  last promoted at
  current regime
  latest drawdown
```

### 6.3 Feedback loop

Thêm user feedback/action events:

```text
user_signal_actions {
  userId,
  signalId,
  action: view | dismiss | mark_risky | execute | ignore,
  reason,
  timestamp
}
```

Ứng dụng:

- UI personalization: user hay ignore token nào thì hạ priority.
- Model analytics: signal high confidence nhưng user luôn dismiss cần audit explanation.
- Execution feedback: nếu user execute, so sánh realized PnL với backtest/expected.

Không nên cho user feedback trực tiếp thay đổi model ngay. Dùng làm feature offline và report trước, sau đó mới đưa vào weighting.

### 6.4 Push vs pull

Đề xuất:

- Trong ĐATN: giữ polling 30 giây, giảm payload và thêm manual refresh.
- Nếu muốn demo realtime tốt hơn: thêm SSE endpoint `/api/signals/stream` push signal delta.
- Future work: WebSocket nếu cần command hai chiều hoặc collaborative dashboard.

SSE payload nên là delta:

```json
{
  "type": "signal.updated",
  "signalId": "...",
  "tokenSymbol": "SOL",
  "patch": {
    "quantScore": 1.84,
    "confidence": 0.61,
    "status": "RAW",
    "updatedAt": "..."
  }
}
```

## 7. Kiến trúc đề xuất

### 7.1 System design

Kiến trúc phù hợp để triển khai trong ĐATN:

```text
                    +--------------------+
                    |  External Sources  |
                    | X, News, Prices    |
                    +---------+----------+
                              |
                              v
                    +--------------------+
                    | Ingestion Jobs     |
                    | Scraper/Fetcher    |
                    +---------+----------+
                              |
                              v
                    +--------------------+
                    | MongoDB            |
                    | Raw Collections    |
                    +---------+----------+
                              |
                              v
                    +--------------------+
                    | Cron Orchestrator  |
                    | every 1-5 minutes  |
                    +---------+----------+
                              |
             +----------------+----------------+
             |                                 |
             v                                 v
   +--------------------+            +--------------------+
   | Quant Detector     |            | Price/Backtest Job |
   | FinBERT + scoring  |            | PnL + win/loss     |
   +---------+----------+            +---------+----------+
             |                                 |
             v                                 v
   +--------------------+            +--------------------+
   | signals            |            | backtest_results   |
   +---------+----------+            +---------+----------+
             |
             v
   +--------------------+
   | Layer3 AI Reasoner |
   | Gemini rationale   |
   +---------+----------+
             |
             v
   +--------------------+
   | proposals          |
   +---------+----------+
             |
             v
   +--------------------+
   | Next.js API/UI     |
   | polling dashboard  |
   +--------------------+

Offline research path:

MongoDB raw/history
  -> replay backtest
  -> grid search weight sets
  -> hyperparameter_configs
  -> compare candidate vs active config
```

Kiến trúc mở rộng sau ĐATN:

```text
                    +--------------------+
                    |  External Sources  |
                    | X, News, Prices    |
                    +---------+----------+
                              |
                              v
                    +--------------------+
                    | Ingestion Layer    |
                    | scraper/fetcher    |
                    +---------+----------+
                              |
                              v
                    +--------------------+
                    | Event Bus          |
                    | Redis Streams      |
                    | Kafka/Redpanda     |
                    +----+----------+----+
                         |          |
                         v          v
          +------------------+   +-------------------+
          | Feature Workers  |   | Price Workers     |
          | FinBERT, tokens  |   | returns, vol      |
          +--------+---------+   +---------+---------+
                   |                       |
                   v                       v
          +-----------------------------------------+
          | Feature Store / State Store             |
          | evidence_features, token_feature_state  |
          | rolling_metrics, sentiment_cache        |
          +-------------------+---------------------+
                              |
                              v
                    +--------------------+
                    | Online Scoring     |
                    | dynamic config     |
                    | regime/correlation |
                    +---------+----------+
                              |
                              v
                    +--------------------+
                    | Signals / Read     |
                    | Model / Cache      |
                    +----+----------+----+
                         |          |
                         v          v
              +--------------+   +----------------+
              | Layer3 Queue |   | API/SSE        |
              | Gemini async |   | Next.js        |
              +------+-------+   +-------+--------+
                     |                   |
                     v                   v
              +--------------+   +----------------+
              | Proposals    |   | Frontend UI    |
              +--------------+   +----------------+

Offline:

MongoDB raw/history
  -> snapshot builder
  -> replay backtest
  -> optimizer
  -> hyperparameter_configs / adaptive_weight_history
  -> active runtime config
```

### 7.2 Thành phần cụ thể

Data ingestion:

- X scraper, news scraper, token price fetcher vẫn ghi MongoDB như hiện tại.
- Trong ĐATN: giữ cách ghi MongoDB như hiện tại.
- Hướng mở rộng: sau mỗi upsert raw data, publish event vào stream.
- Nếu có stream, mỗi event có `eventId`, `source`, `entityId`, `occurredAt`, `payloadHash`.

Processing layer:

- Trong ĐATN: cron gọi `run-quant.ts` để xử lý batch ngắn.
- Nên thêm persistent FinBERT cache để tránh gọi lại model cho text cũ.
- Hướng mở rộng: consumer group `document-feature-worker`, idempotency theo `payloadHash` hoặc `entityId + modelVersion`.

Feature engineering:

- Trong ĐATN: dùng trực tiếp `metadata.scoreComponents` trong `signals`.
- Nên thêm `rolling_metrics` cho price return, volatility, correlation/beta nếu đủ thời gian.
- Hướng mở rộng: `evidence_features` cho mỗi tweet/news-token pair và `token_feature_state` rolling theo token.

Model/scoring:

- Giữ Quant V3 làm baseline.
- Thay `betaToBtc` cố định bằng `dynamicBetaToBtc` khi có đủ data.
- Thay static `alphaBlend/actionThreshold` bằng effective params theo regime.
- Lưu `scoreComponents` đầy đủ để explain.

Backtest engine:

- Mở rộng `replay-engine.ts` thành walk-forward runner.
- Chạy nhiều candidate theo grid nhỏ; song song worker pool là tùy chọn.
- Lưu run/candidate metrics.
- So sánh candidate với active config trước khi promote.

API/frontend:

- `/api/signals` có limit/cursor.
- Trong ĐATN: polling dashboard 30 giây là đủ.
- Hướng mở rộng: `/api/signals/stream` SSE push delta.
- `/api/model-health` trả active config, validation metrics, regime.
- UI hiển thị lifecycle và confidence breakdown.

### 7.3 Công nghệ đề xuất

Backend:

- Node.js/TypeScript tiếp tục phù hợp.
- Trong ĐATN: giữ monorepo hiện tại, `core/run` làm orchestrator, `core/signal-detector` làm Quant Layer, `core/layer3` làm AI Reasoning Layer, `apps/web` làm API/UI.
- Sau ĐATN: có thể tách package mới như `core/stream`, `core/feature-store`, `core/model-optimizer`.

Streaming:

- Trong ĐATN: chưa cần streaming thật; cron 1-5 phút + dashboard polling là đủ để gọi là near real-time.
- Nếu muốn nâng cấp nhẹ: Redis/BullMQ cho job queue.
- Future work: Redis Streams hoặc Kafka/Redpanda khi cần high-throughput/replay retention/consumer scaling.

Storage:

- MongoDB: source of truth, raw data, signals, proposals, backtest.
- Trong ĐATN: MongoDB là đủ.
- Có thể thêm: collection `backtest_runs`, `backtest_candidates`, `rolling_metrics`.
- Future work: Redis cho cache/read model/latest state/stream.
- Nếu price history rất lớn: cân nhắc TimescaleDB hoặc ClickHouse ở phase sau, nhưng chưa cần cho ĐATN.

Compute:

- Trong ĐATN: chạy worker/script theo cron hoặc npm scripts.
- FinBERT có thể giữ như hiện tại, thêm persistent cache để giảm chi phí/latency.
- Layer3 chạy batch nhỏ/async; không để AI blocking việc hiển thị Quant signal.
- Future work: worker processes scale ngang và local inference service nếu HuggingFace API là bottleneck.

## 8. Roadmap triển khai

### Phase 1: Quick win, không phá logic hiện tại

Mục tiêu: hoàn thiện bản ĐATN có thể demo ổn định, giảm latency cảm nhận, tăng explainability, chuẩn bị dữ liệu cho adaptive.

1. API/UI:
   - Thêm default `limit=100`, cursor pagination cho `/api/signals`.
   - Tách UI state `Quant ready` và `AI explanation pending`.
   - Hiển thị confidence breakdown từ `scoreComponents`, entropy, sample size, signalMode.

2. Cache:
   - Thêm persistent `sentiment_cache`.
   - Cache latest signals payload bằng memory cache hoặc MongoDB read model. Redis là tùy chọn.

3. Backtest:
   - Chuẩn hóa `backtest_runs`, `backtest_candidates`.
   - Lưu kết quả replay/HPO thay vì chỉ in console.
   - Chạy optimizer ở dry-run và so sánh active config.

4. Observability:
   - Log latency từng stage: ingestion, FinBERT, quant, DB write, Layer3, API.
   - Thêm metric số signal RAW/PROCESSED/FAILED, Layer3 retry, sparse price rate.

Trade-off: chưa realtime thật, nhưng ít rủi ro vì giữ cron và logic cũ.

### Phase 2: Core improvement

Mục tiêu: nâng chất lượng định lượng của ĐATN: dynamic backtest rõ ràng, rolling correlation, model health, và near real-time tốt hơn.

1. Dynamic weighting:
   - Job tính rolling IC cho source.
   - Update `source_weights.siteWeight`.
   - Grid search các bộ `alphaBlend`, `signalThreshold`, `actionThreshold`, `tweetHalfLifeHours`, `newsHalfLifeHours`.
   - Lưu best candidate vào `hyperparameter_configs`.

2. Correlation/regime:
   - Tạo `rolling_metrics` cho beta/corr/volatility.
   - Thay `betaToBtc` cố định bằng dynamic beta có fallback.
   - Regime service rule-based trả `risk_on`, `defensive`, `stress`, `rotation`, `mixed`.

3. Backtest:
   - Walk-forward validation theo train/validation windows.
   - Candidate vs active comparison.
   - Promotion guardrails.

4. Near real-time cải tiến:
   - Cron 1-5 phút, tránh overlap bằng lock hiện có.
   - Query theo dữ liệu mới/window nhỏ hơn.
   - Layer3 chạy batch nhỏ/async để signal Quant xuất hiện trước.

Trade-off: vẫn chưa phải streaming production, nhưng phù hợp ĐATN và chứng minh được tính adaptive.

### Phase 3: Advanced AI/optimization

Mục tiêu: hướng mở rộng sau ĐATN, hoặc trình bày trong phần future work.

1. Event-driven/streaming:
   - Thêm Redis Streams: `raw_events`, `feature_events`, `signal_events`.
   - Scraper/fetcher publish event sau khi lưu DB.
   - Worker xử lý idempotent.
   - SSE/WebSocket push realtime.

2. Bayesian/source reliability:
   - Update posterior reliability theo outcome.
   - Weight source theo reliability và sample size.

3. Contextual bandit:
   - Chọn weight set/threshold theo regime.
   - Reward là risk-adjusted PnL sau horizon.

4. Bayesian optimization/genetic algorithm:
   - Tối ưu tham số liên tục.
   - Multi-objective: PnL, Sharpe, drawdown, turnover, stability.

5. Execution-aware backtest:
   - Position sizing.
   - Portfolio exposure.
   - Stop-loss/take-profit.
   - Liquidity/slippage theo token.

6. User feedback learning:
   - Thu user action.
   - Dùng offline để đánh giá trust và usefulness.
   - Sau khi ổn định mới đưa vào ranking/personalization.

Trade-off: có rủi ro overfit cao hơn, nên phải bắt buộc out-of-sample validation, canary rollout và rollback config.

## 9. Ưu tiên kỹ thuật đề xuất

Thứ tự nên làm cho ĐATN:

1. Lưu backtest run metadata và candidate metrics.
2. Thêm persistent FinBERT cache.
3. Chạy grid search/rolling window cho dynamic backtest.
4. Thêm rolling correlation/beta đơn giản với BTC.
5. Hiển thị confidence breakdown và model health trên UI.
6. Tối ưu `/api/signals` bằng limit/cursor.
7. Giữ cron near real-time 1-5 phút, không cần Kafka.

Thứ tự sau ĐATN nếu tiếp tục phát triển:

1. Thêm Redis Streams cho raw events và signal events.
2. Chuyển UI từ polling sang SSE.
3. Tạo feature store riêng.
4. Bật adaptive promotion có guardrails.
5. Thử Bayesian optimization hoặc contextual bandit.

Nguyên tắc giữ an toàn:

- Quant V3 hiện tại là baseline, không thay thế ngay.
- Mọi dynamic weight phải lưu version, effective time, reason và metrics.
- UI luôn hiển thị config/model version để user hiểu tín hiệu đến từ đâu.
- Backtest phải replay từ raw snapshot, không chỉ đánh giá proposal đã sinh.
- Không promote config nếu validation không tốt hơn active config trên cùng dữ liệu.
- Với ĐATN, ưu tiên demo ổn định và giải thích rõ trade-off hơn là triển khai hạ tầng realtime phức tạp.
