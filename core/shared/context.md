### 1. Mục đích thư mục

`core/shared` là package dùng chung cho MongoDB schemas, connection, logger, constants và domain types.

### 2. Thành phần bên trong

- `src/db/connection.ts`, `src/db/index.ts`: MongoDB connection/export schemas.
- `src/db/schema`: Mongoose schemas cho users, tokens, tweets, news, signals, proposals, prices, backtests, hyperparams, positions.
- `src/constants`: static/mock data.
- `src/repositories/interface`: repository contracts cho tweet/X account.
- `src/types`: portfolio, tweets, x-account, logging.
- `src/utils`: logger, db logging, Gemini client, portfolio helpers.
- `scripts`: DB connection/schema/integrity test scripts.

### 3. Luồng hoạt động

Packages import `connectToDatabase`, table/model exports, logger, and utility functions. `@gr2/shared` is built with TypeScript and exported via `dist`.

### 4. Dependency

Uses Mongoose, uuid, web-push, zod. It is depended on by web, scrapers, signal detector, layer3, price fetcher, backtest.

### 5. Logic quan trọng

Important collections:

- `signals`: quant output with `quantScore`, `confidence`, `suggestionType`, `status`.
- `proposals`: Layer 3 output and backtest fields.
- `tokens`, `token_prices`, `token_price_history`: token metadata and price source for portfolio/backtest.
- `tweets`, `news_articles`: raw evidence for FinBERT and Layer 3.
- `hyperparameter_configs`, `backtest_results`: strategy evaluation/config feedback.

### 6. Rủi ro / vấn đề

- Several `.d.ts/.js/.map` files are present under `src/types`, likely generated artifacts mixed with source.
- Schema uses mixed/case-flexible fields in many places, which helps migration but weakens contract.
- `token_price_history.priceUsd` is String, while runtime often parses it into number.

### 7. Cách cải thiện

- Keep generated files outside `src`.
- Add Zod DTO schemas for public API responses.
- Migrate price fields to numeric Mongo type if possible.
- Add unique/idempotency indexes for signals/proposals where duplicate processing matters.

