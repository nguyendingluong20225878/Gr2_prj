# GR2 Project

GR2 Project is a TypeScript monorepo for Web3 signal detection, proposal generation, and portfolio-facing UI. The system collects X/Twitter and crypto news data, scores token-level alpha signals, generates Vietnamese investment rationales, backtests outcomes, and exposes the results through a Next.js dashboard.

## Repository Layout

```text
.
├── apps/
│   └── web/                  # Next.js app and backend-for-frontend API routes
├── core/
│   ├── shared/               # Shared MongoDB schemas, DB utilities, domain helpers
│   ├── x-scaper/             # X/Twitter scraper
│   ├── news-scraper/         # Crypto news scraper and token tagger
│   ├── token-price-fetcher/  # Jupiter price updater and historical backfill
│   ├── signal-detector/      # Quant/FinBERT signal engine
│   ├── research/             # Backtest, metrics, regime, dynamic weights
│   ├── layer3/               # LangGraph/Gemini proposal generator
│   └── run/                  # Cron-style orchestration runner
├── scripts/                  # Root helper scripts
├── FE_UI.md                  # Frontend UI notes
└── overview.md               # Project overview notes
```

## Main Pipeline

The batch pipeline is wired from the root `package.json`:

```text
X scrape/news scrape
→ token price backfill
→ backtest outcome update
→ rolling metrics/regime/dynamic weights
→ signal detector
→ Layer 3 proposal generator
```

Use the composed command when you want the full batch flow:

```bash
npm run pipeline:batch
```

Use the cron runner when you want the orchestrator package:

```bash
npm run pipeline
```

## Common Commands

```bash
# Install all workspaces
npm install

# Run all workspace dev commands through Turbo
npm run dev

# Build workspaces
npm run build

# Run tests through Turbo
npm run test

# Run the Next.js app only
npm --workspace @gr2/web run dev

# Run signal detection only
npm run signal

# Run Layer 3 proposal generation only
npm --workspace @gr2/proposal-generator run layer3
```

## Environment

Most backend packages expect a local `.env` in their package directory or are run with `tsx --env-file=...`. Common variables include:

```env
MONGODB_URI=mongodb://localhost:27017/gr2
GOOGLE_API_KEY=...
GEMINI_API_KEY=...
HUGGINGFACE_API_KEY=...
FIRECRAWL_API_KEY=...
JUPITER_API_URL=https://api.jup.ag/price/v2
```

The web app also uses public Next.js variables such as:

```env
NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

Check each package README for package-specific variables and commands.

## Data Model

`core/shared` owns the shared Mongoose models. The most important collections are:

- `tweets` and `news_articles`: raw evidence.
- `tokens`, `token_prices`, and `token_price_history`: token metadata and pricing.
- `signals`: Layer 2 quant output.
- `proposals`: Layer 3 rationale and user-facing proposal state.
- `backtest_results`, `hyperparameter_configs`, and source weights: feedback for model tuning.
- `users`, `trade_executions`, and `perp_positions`: web app/user portfolio state.

## Documentation Map

- [apps/README.md](apps/README.md): application packages.
- [apps/web/README.md](apps/web/README.md): frontend and API routes.
- [core/README.md](core/README.md): backend/research packages.
- [core/shared/README.md](core/shared/README.md): shared schemas and DB helpers.
- [core/run/README.md](core/run/README.md): orchestration runner.
