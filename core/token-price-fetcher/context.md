### 1. Mục đích thư mục

`token-price-fetcher` cập nhật giá token hiện tại và lịch sử để phục vụ portfolio, fallback price, và backtest.

### 2. Thành phần bên trong

- `src/services/token-price-service.ts`: service chính cho update current prices và backfill historical prices.
- `src/services/providers/coingecko.provider.ts`: top coins, simple price, market chart range.
- `src/services/providers/jupiter.provider.ts`, `token-registry.provider.ts`: provider hỗ trợ SPL/registry.
- `scripts/backfill-token-price-history.ts`: CLI backfill.
- `scripts/import-top-coins.ts`, `update-token-prices.ts`: import/update scripts.
- `src/server.ts`, `src/process.ts`, `src/index.ts`: service/cron entrypoints.

### 3. Luồng hoạt động

`updatePrices` đọc tokens có `coingeckoId`, gọi CoinGecko simple price, upsert `token_prices` theo `tokenKey = coingecko:<id>`. Backfill gọi market chart/range, downsample theo interval, insert history points vào `token_price_history`.

### 4. Dependency

Depends on `@gr2/shared`, CoinGecko provider, `node-cron`.

### 5. Logic quan trọng

`downsamplePricePoints` bucket timestamp theo interval hours và giữ point đầu tiên trong mỗi bucket. Backfill có concurrency, retry, skip-existing, recent-only filters from proposals/signals.

### 6. Rủi ro / vấn đề

- `getTokenPrice` queries `{ tokenAddress }` on `token_prices`, but shared `token_prices` schema defines `tokenKey`, `token`, `priceUsd`, `lastUpdated`, `source`; `tokenAddress` is not in schema.
- History stores `priceUsd` as string in schema, so numeric comparisons require parsing.
- CoinGecko rate limits can throttle backfill.
- `apps/web/api/portfolio` no longer hardcodes fallback token prices. Missing current prices surface as `MISSING_PRICE` instead of fake valuation.

### 7. Cách cải thiện

Normalize token key model across current/history/portfolio. Add provider rate-limit backoff and API key support. Store numeric price consistently.
