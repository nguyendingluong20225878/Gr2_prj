### 1. Mục đích thư mục

`core` chứa toàn bộ backend/data/quant pipeline độc lập với UI: shared database contract, scrapers, price fetcher, signal detector, proposal reasoning, backtest, scheduler.

### 2. Thành phần bên trong

- `shared`: DB schemas, logger, types, constants.
- `x-scaper`: Selenium scraper cho X/Twitter.
- `news-scraper`: RSS/HTML/Firecrawl news scraper.
- `token-price-fetcher`: CoinGecko price update/backfill.
- `signal-detector`: FinBERT + quant alpha engine.
- `layer3`: LangGraph/Gemini proposal generator.
- `research/backtest`: proposal PnL and hyperparameter replay.
- `run`: cron runner.

### 3. Luồng hoạt động

Data collectors populate raw collections. Quant detector reads raw collections and tokens, inserts signals. Layer 3 reads raw signals and inserts proposals. Backtest reads proposals and price history, writes PnL/outcome.

### 4. Dependency

Most packages depend on `@gr2/shared`. `signal-detector` also calls HuggingFace FinBERT. `layer3` calls Gemini. `token-price-fetcher` calls CoinGecko. `x-scaper` uses Selenium/Chrome.

### 5. Logic quan trọng

Core enforces the system rule: math/ML produces ground truth signal; LLM explains. Backtest creates feedback for strategy/hyperparameter quality.

### 6. Rủi ro / vấn đề

- Scheduler in `core/run` currently comments out X scraping and only runs quant + layer3 every minute.
- External API credentials and rate limits directly affect pipeline.
- Lack of strong job queue/retry/state machine can cause duplicate or missed processing.

### 7. Cách cải thiện

Introduce durable job orchestration, idempotency keys per stage, typed event contracts, and observability dashboards for pipeline health.

