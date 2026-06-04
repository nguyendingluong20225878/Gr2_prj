# @gr2/run

`core/run` is the cron-style orchestrator for the backend pipeline.

## Responsibilities

- Connect to MongoDB.
- Schedule periodic backend work with `node-cron`.
- Prevent local overlap with an in-process lock.
- Prevent multi-instance overlap with a MongoDB job lock.
- Run quant signal detection and Layer 3 proposal generation sequentially.

## Structure

```text
core/run
└── src/
    └── index.ts
```

## Commands

```bash
# Start development runner
npm --workspace @gr2/run run dev

# Root shortcut
npm run pipeline

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

- The runner is orchestration glue. Business logic lives in `signal-detector`, `layer3`, and `research`.
- The X scraping step is currently not part of the active runner flow in `src/index.ts`.
- `execSync` blocks the event loop; for production-grade scheduling, consider a durable queue with per-stage retries and metrics.
