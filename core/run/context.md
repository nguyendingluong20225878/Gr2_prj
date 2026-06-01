### 1. Mục đích thư mục

`core/run` is the master cron runner for the backend pipeline.

### 2. Thành phần bên trong

- `src/index.ts`: connects DB, schedules cron every minute, runs signal detector and Layer 3 scripts via `execSync`.
- `package.json`, `tsconfig.json`, `.env`: package/runtime config.

### 3. Luồng hoạt động

On start, connect database and schedule `*/1 * * * *`. A process-level `isRunning` lock prevents overlap inside one process, and a MongoDB `job_locks` document now prevents overlap across multiple instances. The X scraping step is currently commented out. Quant and Layer 3 scripts run sequentially. Layer 3 batch size is capped by `LAYER3_BATCH_LIMIT` with default `3`.

### 4. Dependency

Depends on `node-cron`, `child_process`, `@gr2/shared`, and package scripts/files in sibling core modules.

### 5. Logic quan trọng

This runner is orchestration glue, not business logic. It assumes scripts are idempotent enough to run repeatedly.

### 6. Rủi ro / vấn đề

- `execSync` blocks event loop and gives coarse error handling.
- DB lock is a pragmatic improvement but not a full durable queue.
- Every-minute Layer 3 can still hit LLM quota if `LAYER3_BATCH_LIMIT` is too high or RAW backlog grows.

### 7. Cách cải thiện

Use a durable job queue with per-stage retries, metrics, and idempotency keys. Call package functions directly instead of shelling out.
