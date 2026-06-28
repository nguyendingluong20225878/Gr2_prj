### 1. Mục đích thư mục

`core/run` is the canonical orchestrator for the backend pipeline. It supports both one-shot execution for external scheduling and long-running cron scheduling.

### 2. Thành phần bên trong

- `src/index.ts`: connects DB, runs the full pipeline once when invoked with `--once`, or schedules the same pipeline with `node-cron` in scheduler mode.
- `package.json`, `tsconfig.json`, `.env`: package/runtime config.

### 3. Luồng hoạt động

The root command `npm run pipeline:core` calls `@gr2/run` in one-shot mode. In scheduler mode, the default cron expression is `0 0,12 * * *` with timezone `Asia/Ho_Chi_Minh`, and it can be overridden with `PIPELINE_CRON` and `PIPELINE_TIMEZONE`. A process-level `isRunning` lock prevents overlap inside one process, and a MongoDB `job_locks` document prevents overlap across multiple instances. The active pipeline runs X scraping when credentials are available, news scraping, one-day price backfill, backtest outcome, rolling metrics, regime, dynamic weights, quant signal detection, and Layer 3 proposal generation sequentially.

### 4. Dependency

Depends on `node-cron`, `child_process.spawn`, `@gr2/shared`, and package scripts/files in sibling core modules.

### 5. Logic quan trọng

This runner is orchestration glue, not business logic. It assumes scripts are idempotent enough to run repeatedly.

### 6. Rủi ro / vấn đề

- DB lock is a pragmatic improvement but not a full durable queue.
- Long-running pipeline steps can still hit external API or LLM quota if scraper limits or `LAYER3_BATCH_LIMIT` are too high.
- Shelling out through npm scripts keeps package boundaries simple, but gives less structured observability than a dedicated job runner.

### 7. Cách cải thiện

Use a durable job queue with per-stage retries, metrics, and idempotency keys. Consider calling package functions directly when the pipeline needs richer observability and typed stage results.
