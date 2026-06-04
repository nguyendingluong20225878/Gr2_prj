# @gr2/token-price-fetcher

`core/token-price-fetcher` updates latest token prices and historical price records using the Jupiter price API.

## Responsibilities

- Fetch token prices from Jupiter.
- Persist latest price snapshots in MongoDB.
- Backfill historical price records for backtests and portfolio valuation.
- Run once or on a cron schedule.

## Structure

```text
core/token-price-fetcher
├── scripts/
│   ├── backfill-token-price-history.ts
│   ├── import-top-coins.ts
│   └── update-token-prices.ts
└── src/
    ├── index.ts
    ├── process.ts
    └── server.ts
```

## Commands

Run from the repository root:

```bash
# One-time server/dev mode
npm --workspace @gr2/token-price-fetcher run dev

# Cron mode
npm --workspace @gr2/token-price-fetcher run dev:cron

# Generic history backfill
npm --workspace @gr2/token-price-fetcher run backfill:history

# One-day backfill used by the root pipeline
npm run prices:backfill:1d

# Demo backfill
npm run demo:backfill-prices

# Build
npm --workspace @gr2/token-price-fetcher run build
```

## Environment

```env
MONGODB_URI=mongodb://localhost:27017/gr2
PRICE_UPDATE_CRON=*/10 * * * *
JUPITER_API_URL=https://api.jup.ag/price/v2
```

## Notes

- Historical prices are consumed by `core/research/backtest` and portfolio pages.
- `backfill:history:1d` uses delays and retries to reduce rate-limit failures.
- Missing prices should remain visible to the UI as missing data instead of being silently replaced with fake values.
