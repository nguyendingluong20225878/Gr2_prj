### 1. Mục đích thư mục

`backtest` đánh giá quyết định giao dịch từ proposals hoặc replay signal-detector với hyperparameter candidates.

### 2. Thành phần bên trong

- `engine.ts`: backtest proposals thật trong DB.
- `pnl-evaluator.ts`: pure function evaluator cho virtual proposals.
- `replay-engine.ts`: replay historical tweets/news qua signal-detector để tạo virtual proposals.
- `hyperparameter-grid.ts`: tạo grid và score objective.
- `optimize-hyperparams.ts`: train/validation HPO and promote config.
- `run-backtest.ts`: CLI entrypoint.
- `backtest.ts`, `backtestJob.ts`: legacy/older runners.

### 3. Luồng hoạt động

Proposal backtest: query proposals, resolve direction, load price around detected/expiry timestamps, compute trade PnL, persist result.

Replay HPO: build as-of schedule, load snapshot docs, run detector with candidate hyperparams, evaluate virtual proposals against historical prices, rank candidates.

### 4. Dependency

Depends on `@gr2/shared`, `token-price-fetcher`, `signal-detector`.

### 5. Logic quan trọng

Direction mapping:

- `buy`/`stake` -> LONG.
- `sell`/`close_position` -> SHORT.
- `hold` -> FLAT in `engine.ts`; `pnl-evaluator.ts` skips hold because it only maps LONG/SHORT.

PnL formulas are documented in `logic.md`.

### 6. Rủi ro / vấn đề

- `engine.ts` and `pnl-evaluator.ts` now share PnL math through `trade-math.ts`; `engine.ts` still supports HOLD/FLAT missed-move logic, while virtual evaluator skips non-directional proposals.
- Replay now maintains a rolling `historicalData` map from emitted signal `unifiedRaw`, reducing pure cold-start bias during HPO. It is still partial because tokens without emitted signals do not yet contribute history.
- `allowCurrentPriceFallback` can contaminate historical evaluation with current price.

### 7. Cách cải thiện

- Build full historical `unifiedRaw` state per token, including non-emitted token states, for more faithful HPO.
- Keep current price fallback disabled for research metrics.
- Add IC/correlation metrics if docs still require IC.
