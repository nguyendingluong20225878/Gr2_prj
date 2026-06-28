# Core Packages

`core` contains the backend, data, research, and orchestration packages for the GR2 pipeline.

## Packages

| Package | Purpose |
| --- | --- |
| `shared` | Shared MongoDB connection, Mongoose schemas, logger, constants, and domain utilities. |
| `x-scaper` | Scrapes configured X/Twitter accounts and stores tweets/engagement metadata. |
| `news-scraper` | Discovers, scrapes, cleans, token-tags, and stores crypto news articles. |
| `token-price-fetcher` | Updates latest token prices and historical price snapshots from Jupiter. |
| `signal-detector` | Scores tweet/news evidence and emits token-level quant signals. |
| `research` | Backtest, rolling metrics, regime detection, source weights, and maintenance jobs. |
| `layer3` | Generates Vietnamese proposal rationales from raw signals using LangGraph/Gemini. |
| `run` | Canonical one-shot and cron-style process that orchestrates the full core pipeline. |

## Typical Batch Flow

```text
x-scaper + news-scraper
→ research metrics/regime/weights
→ signal-detector
→ layer3
→ research/backtest outcome
→ apps/web
```

`token-price-fetcher` is deployed as a separate price job and writes market data to MongoDB for the pipeline and dashboard to consume.

## Root Commands

From the repository root:

```bash
npm run scraper                  # X/Twitter scraper
npm run news                     # News scraper
npm run prices:backfill:1d       # Manual one-day price history backfill, outside pipeline:core
npm run backtest:outcome         # Backtest generated proposals
npm run metrics                  # Rolling metrics
npm run regime                   # Regime detection
npm run weights                  # Dynamic source/strategy weights
npm run signal                   # Quant signal detector
npm run pipeline:core            # Full one-shot core pipeline
npm run pipeline                 # Alias of pipeline:core
npm run pipeline:batch           # Backward-compatible alias of pipeline:core
npm run pipeline:scheduler       # Long-running cron scheduler
```

## Environment

Each package can load its own `.env`. The most common shared variables are:

```env
MONGODB_URI=mongodb://localhost:27017/gr2
HUGGINGFACE_API_KEY=...
GEMINI_API_KEY=...
GOOGLE_API_KEY=...
FIRECRAWL_API_KEY=...
JUPITER_API_URL=https://api.jup.ag/price/v2
```

Scraping packages may also require local browser/cookie credentials. Keep secrets out of source control.

## Development Notes

- `shared` is the schema source of truth for most collections.
- `dist` folders are build output and should not be edited manually.
- `context.md`, `flow.md`, and `logic*.md` files document deeper implementation details for each module.
- Prefer package scripts over directly running built files while developing.
