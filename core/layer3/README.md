# @gr2/layer3

`core/layer3` is the Layer 3 proposal generator. It reads raw quant signals and creates Vietnamese proposal rationales with LangGraph and Gemini.

## Responsibilities

- Find `signals` with `status: RAW`.
- Validate required signal fields.
- Resolve source evidence from `tweets` and `news_articles`.
- Generate a concise Vietnamese BUY/SELL/HOLD rationale.
- Upsert a related `proposals` document.
- Mark processed signals as `PROCESSED` or failed signals as `FAILED`.

## Structure

```text
core/layer3
├── scripts/
│   ├── run-layer3.ts
│   └── check-models.ts
├── src/
│   ├── agent.ts       # LangGraph/Gemini node
│   ├── workflow.ts    # Batch DB workflow
│   ├── state.ts       # Proposal state contract
│   └── index.ts
└── tests/
```

## Commands

```bash
# Run Layer 3 batch
npm --workspace @gr2/layer3 run layer3

# Build
npm --workspace @gr2/layer3 run build

# Test
npm --workspace @gr2/layer3 run test
```

The root batch pipeline also runs this package at the end:

```bash
npm run pipeline:batch
```

## Environment

```env
MONGODB_URI=mongodb://localhost:27017/gr2
GEMINI_API_KEY=...
GOOGLE_API_KEY=...
LAYER3_BATCH_LIMIT=3
```

## Notes

- Layer 3 explains Layer 2; it should not override quant scoring without explicit schema/business logic.
- Keep prompt/version/model metadata in mind when changing rationale generation.
- Large evidence payloads can increase latency and model cost.
