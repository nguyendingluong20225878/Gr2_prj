### 1. Mục đích thư mục

`schema` là database contract của hệ thống.

### 2. Thành phần bên trong

Nhóm chính:

- Auth/user: `users`, `accounts`, `sessions`, `verification_tokens`, `authenticators`, `push_subscriptions`.
- Raw data: `tweets`, `x_accounts`, `news_articles`, `news_sites`, Farcaster schemas.
- Market data: `tokens`, `token_prices`, `token_price_history`, `funding_rates`, `interest_rates`.
- Decision data: `signals`, `proposal`, `investments`, `transactions`, `perp_positions`, `portfolio_snapshots`.
- Evaluation/config: `backtest_results`, `hyperparameter_configs`, `signal_weights`, `source_weights`, `logs`.

### 3. Luồng hoạt động

Scrapers write raw data. Quant writes `signals`. Layer 3 writes `proposals`. Trade execution writes `trade_executions` raw collection in web route and `perp_positions`. Backtest updates proposals and writes `backtest_results`.

### 4. Dependency

Imported by `core/shared/src/db/index.ts`, then consumed by all backend packages.

### 5. Logic quan trọng

`signals.ts` has status lifecycle `RAW -> PROCESSED | FAILED`. It now stores `uncertaintyEntropy` separately from optional `realizedVolatility`; `volatilityFlag` remains as a backward-compatible alias for older UI code. It also stores `signalMode = COLD_START | NORMALIZED_ALPHA`.

`proposal.ts` has execution lifecycle `PENDING -> EXECUTED | IGNORED` and backtest result fields `entryPrice`, `exitPrice`, `actualPnL`, `winLossStatus`, `pnlPercentage`. It also includes legacy UI fields (`financialImpact`, `status`, `action`, `title`, `summary`, `reason`, `tokenName`) so `apps/web` can import the shared model without losing existing display behavior.

### 6. Rủi ro / vấn đề

`signals.sources` and `proposals.sources` now explicitly include optional `sourceKey` and `weight`, allowing quant evidence weights to persist for explainability.

### 7. Cách cải thiện

Add model version, prompt version, and DTO validation. Once legacy proposal docs are migrated, make canonical fields required again where appropriate.
