# GR2 Web App

`apps/web` is the Next.js frontend and backend-for-frontend layer for GR2. It shows signal analytics, opportunities, proposals, portfolio state, positions, alerts, and wallet-driven user flows.

## Tech Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Radix UI primitives and local shadcn-style components
- Solana wallet adapter and Phantom wallet support
- MongoDB/Mongoose through local API routes and `@gr2/shared`
- SWR/browser fetch hooks for client data loading
- Recharts for analytics charts

## Structure

```text
apps/web
├── app/
│   ├── api/                  # Next.js route handlers
│   ├── components/           # Layout, wallet, proposal, portfolio, UI atoms
│   ├── contexts/             # Auth and trading demo contexts
│   ├── overview/             # Main command-center view
│   ├── signals/              # Signal list/detail views
│   ├── opportunities/        # Opportunity views
│   ├── proposal/[id]/        # Proposal detail and decision view
│   ├── positions/            # Open position views
│   ├── portfolio/            # Portfolio summary
│   ├── alerts/               # Risk/analytics alerts
│   ├── tokens/[symbol]/      # Token detail view
│   ├── profile/              # User settings
│   ├── onboarding/           # New user setup
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── hooks/                # useSignals, useProposals, usePortfolio, analytics hooks
│   ├── utils/                # Semantic mapping, formatting, navigation, analytics helpers
│   ├── constants/            # Token display fallbacks
│   ├── api/                  # API client helpers
│   └── mongodb.ts            # Server-side Mongo connection helper
├── models/                   # Compatibility model adapters for API routes
└── services/                 # Service wrappers used by routes
```

## Commands

Run from the repository root:

```bash
# Development server
npm --workspace @gr2/web run dev

# Development with mock API behavior
npm --workspace @gr2/web run dev:mock

# Development against real API/database behavior
npm --workspace @gr2/web run dev:real

# Production build
npm --workspace @gr2/web run build

# Start the built app
npm --workspace @gr2/web run start
```

## Environment

Create `apps/web/.env.local` for local development.

```env
MONGODB_URI=mongodb://localhost:27017/gr2
NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

Useful switches:

- `NEXT_PUBLIC_USE_MOCK_API=true`: client hooks use mock API behavior where supported.
- `NEXT_PUBLIC_DEMO_MODE=true`: demo fallback data may be shown instead of hard failures.
- `NEXT_PUBLIC_USE_MOCK_API=false`: pages call the real Next API routes.

## Main Pages

- `/`: landing/root entry.
- `/overview`: command center for market/signal state.
- `/signals` and `/signals/[id]`: signal workbench and detail.
- `/signals/daily`: daily signal view.
- `/opportunities` and `/opportunities/[id]`: opportunity discovery.
- `/proposal/[id]`: Layer 3 proposal detail, evidence, decision, and execution surface.
- `/positions` and `/positions/[id]`: open position monitoring.
- `/portfolio`: holdings and portfolio summary.
- `/alerts`: risk/analytics alerts derived from signal rows.
- `/model-health`: model health/status page.
- `/data-check` and `/diagnostics`: local inspection/debug pages.
- `/watchlist`, `/tokens/[symbol]`, `/profile`, `/onboarding`: user workflow pages.

## API Routes

The API layer is colocated in `app/api` and talks to MongoDB.

- `GET /api/signals`: list signals and enrich them with related proposal data.
- `GET /api/signals/[id]`: signal detail.
- `GET /api/proposals`: active/pending proposals.
- `GET /api/proposals/[id]`: proposal detail with signal fallback support.
- `POST /api/proposals/[id]/decision`: write ENTER/WAIT/REJECT audit decisions.
- `GET /api/portfolio`: holdings, positions, and watchlist state.
- `POST /api/trade/execute`: demo trade execution and position creation.
- `GET /api/model-health`: model status data.
- `POST /api/seed`: local seed helper.

## Data Flow

1. Core packages write `signals`, `proposals`, price, tweet, news, and portfolio data into MongoDB.
2. API routes normalize database records into UI DTOs.
3. Hooks in `lib/hooks` fetch API routes and compute user-facing analytics rows.
4. Pages render normalized state and avoid recomputing quant alpha on the client.

## Implementation Notes

- `models/Signal.ts` and `models/Proposal.ts` re-export shared models from `@gr2/shared` to keep older import paths working.
- Some API routes still use raw `db.collection` access. When changing schemas, check route DTO mapping carefully.
- `buildSignalAnalytics` in `lib/utils/signalAnalytics.ts` ranks and summarizes already-produced signals; it should not become a second quant engine.
- Keep demo data behind explicit demo/mock flags so production failures remain visible.
