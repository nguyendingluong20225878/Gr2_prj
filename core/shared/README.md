# @gr2/shared

`core/shared` is the shared package used by the web app and backend jobs. It owns MongoDB connection helpers, Mongoose schemas, domain types, constants, logging, and utility functions.

## What Lives Here

```text
core/shared
├── src/
│   ├── db/
│   │   ├── connection.ts      # MongoDB connection helper
│   │   ├── index.ts           # DB/model exports
│   │   └── schema/            # Mongoose schemas
│   ├── constants/             # Static/mock constants
│   ├── repositories/          # Repository contracts
│   ├── types/                 # Shared TypeScript types
│   └── utils/                 # Logger, Gemini client, portfolio helpers
└── scripts/                   # DB test/migration scripts
```

## Important Collections

- `signals`: Layer 2 quant output with score, confidence, suggestion type, source metadata, and status.
- `proposals`: Layer 3 proposal/rationale output, execution fields, and backtest fields.
- `tweets`: scraped X/Twitter evidence and engagement.
- `news_articles`: scraped news evidence and detected tokens.
- `tokens`, `token_prices`, `token_price_history`: token metadata and price sources.
- `backtest_results`, `hyperparameter_configs`: research feedback and active strategy configuration.
- `users`, `trade_executions`, `perp_positions`: web/user portfolio state.

## Commands

```bash
# Build package
npm --workspace @gr2/shared run build

# Seed database data
npm --workspace @gr2/shared run db:seed

# Test connection, schemas, and data integrity
npm --workspace @gr2/shared run test:all

# Run token identity migration
npm --workspace @gr2/shared run migrate:token-identity
```

## Notes

- This package exports built files from `dist`, so run the build after schema/type changes if consumers depend on compiled output.
- `Signal` and `Proposal` models are re-exported by `apps/web/models` for compatibility with older web imports.
- Be careful when changing field names: several API routes still support legacy/case-flexible fields for migration safety.
