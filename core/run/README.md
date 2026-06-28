# @gr2/run

`core/run` is the canonical orchestrator for the backend pipeline. It can run once for an external scheduler or run as a long-lived cron process.

## Responsibilities

- Connect to MongoDB.
- Run the full backend pipeline in a single, ordered flow.
- Schedule periodic backend work with `node-cron` when started in scheduler mode.
- Prevent local overlap with an in-process lock.
- Prevent multi-instance overlap with a MongoDB job lock.
- Run scraping, price backfill, backtest outcome, metrics, regime, weights, quant signal detection, and Layer 3 proposal generation sequentially.

## Structure

```text
core/run
└── src/
    └── index.ts
```

## Commands

```bash
# Run the full pipeline once
npm run pipeline:core

# Backward-compatible aliases for the same one-shot runner
npm run pipeline
npm run pipeline:batch

# Start the long-running cron scheduler
npm run pipeline:scheduler

# Start compiled runner
npm --workspace @gr2/run run start
```

## Environment

Create `core/run/.env`:

```env
MONGODB_URI=mongodb://localhost:27017/gr2
LAYER3_BATCH_LIMIT=3
```

Sibling scripts may require their own env variables, such as `HUGGINGFACE_API_KEY` and `GEMINI_API_KEY`.

## Notes

- The runner is orchestration glue. Business logic lives in `x-scaper`, `news-scraper`, `token-price-fetcher`, `research`, `signal-detector`, and `layer3`.
- The root command `npm run pipeline:core` is kept as the stable operational command.
- For production-grade scaling, consider a durable queue with per-stage retries and metrics.
