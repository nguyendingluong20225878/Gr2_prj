```mermaid
graph TD
  X["X accounts"] --> XS["core/x-scaper"]
  NewsSites["News sites/RSS"] --> NS["core/news-scraper"]
  Tokens["tokens collection"] --> SD["core/signal-detector"]
  XS --> Tweets["tweets collection"]
  NS --> Articles["news_articles collection"]
  Tweets --> SD
  Articles --> SD
  SD --> Signals["signals collection"]
  Signals --> L3["core/layer3 LangGraph + Gemini"]
  Articles --> L3
  Tweets --> L3
  L3 --> Proposals["proposals collection"]
  Prices["core/token-price-fetcher"] --> PriceHistory["token_price_history"]
  Proposals --> Backtest["core/research/backtest"]
  PriceHistory --> Backtest
  Backtest --> BacktestResults["backtest_results + proposal PnL fields"]
  Signals --> WebAPI["apps/web API routes"]
  Proposals --> WebAPI
  BacktestResults --> WebAPI
  WebAPI --> UI["Next.js dashboard/signals/proposal/alerts/positions"]
```

<!-- ```mermaid
sequenceDiagram
  participant Cron as core/run cron
  participant Quant as signal-detector
  participant DB as MongoDB
  participant L3 as layer3
  participant Web as apps/web
  Cron->>Quant: run-quant.ts
  Quant->>DB: read tweets/news/tokens/hyperparams
  Quant->>Quant: FinBERT + weighting + alpha normalization
  Quant->>DB: insert signals(status RAW)
  Cron->>L3: run-layer3.ts
  L3->>DB: read RAW signals and source content
  L3->>L3: Gemini rationale
  L3->>DB: upsert proposal, mark signal PROCESSED
  Web->>DB: API routes query signals/proposals/prices/positions
  Web->>Web: hooks normalize into analytics rows
```
 -->
