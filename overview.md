# GR2 / NDL Project Overview

Cap nhat tai lieu: 2026-06-04.

Tai lieu nay mo ta trang thai hien tai cua du an trong working tree, gom ca `core` va frontend `apps/web`. Du an la mot monorepo TypeScript cho he thong Web3/Crypto Signal Detection va Proposal Generation: thu thap tin tuc/X, cap nhat gia token, tinh chi so dinh luong, phat hien signal, sinh giai thich bang AI, backtest ket qua, va hien thi thanh dashboard Solana DeFi cho nguoi dung.

## 1. Tom Tat He Thong

GR2/NDL gom 2 khoi lon:

- **Core pipeline**: cac worker va package xu ly du lieu. Core doc MongoDB, crawl nguon tin, crawl X/Twitter, lay gia token, tinh rolling metrics/regime/source weights, tao quant signal, tao proposal Layer3 bang Gemini, va chay backtest/outcome.
- **Frontend**: Next.js App Router trong `apps/web`, hien thi dashboard tieng Viet cho wallet Solana. FE co login bang chu ky vi, onboarding/profile, overview, portfolio, signals, proposals, watchlist, positions, alerts, model health, va cac man hinh chi tiet.

Luoc do du lieu chinh:

```text
News sites + X accounts + token list + price history
        |
        v
news_articles / tweets / tokens / token_price_history
        |
        v
research metrics: rolling_metrics, source_weights, signal_weights, regime
        |
        v
signal-detector Quant V3 -> signals
        |
        v
Layer3 proposal workflow -> proposals
        |
        v
backtest outcome + trade simulation -> proposals / backtest_* / perp_positions
        |
        v
Next.js API routes -> dashboard UI
```

## 2. Monorepo Va Tooling

Root `package.json` khai bao npm workspaces:

- `apps/*`
- `core/*`
- `services/*`

Cong cu chinh:

- **npm workspaces** de lien ket package noi bo.
- **Turborepo** de build/dev/lint/test theo task.
- **TypeScript** strict o root, `target ES2022`, `module NodeNext`.
- **MongoDB/Mongoose** la persistence layer chinh.
- **Vitest** cho mot so package core.

Scripts quan trong o root:

- `npm run dev`: chay `turbo run dev`.
- `npm run build`: build toan bo workspace qua Turbo.
- `npm run pipeline:core`: chay core pipeline mot lan thong qua orchestrator `@gr2/run`.
- `npm run pipeline`: alias cua `pipeline:core`.
- `npm run pipeline:batch`: alias tuong thich nguoc cua `pipeline:core`.
- `npm run scraper`: chay X scraper.
- `npm run news`: chay news scraper.
- `npm run prices:backfill:1d`: backfill lich su gia 1 ngay khi can chay thu cong; job gia duoc van hanh rieng, khong nam trong `pipeline:core`.
- `npm run metrics`: tinh rolling metrics.
- `npm run regime`: tinh market regime.
- `npm run weights`: cap nhat dynamic source weights.
- `npm run signal`: chay quant signal detector.
- `npm run backtest:outcome`: cham ket qua proposal/signal sau horizon.
- `npm run test`: chay Turbo test.

## 3. Core Packages

### 3.1 `core/shared`

Day la package nen tang va la source of truth cho database models, types, constants va utilities.

Vai tro chinh:

- Quan ly ket noi MongoDB qua `connectToDatabase()` va `disconnectFromDatabase()`.
- Export Mongoose models/schema cho cac collection chinh.
- Dinh nghia constants, logger, db logging helpers.
- Cung cap `TokenIdentityResolver`/`resolveToken` de map token theo symbol, address, mint, coingeckoId, priceKey.
- Dong vai tro compatibility layer cho FE: `apps/web/models/Signal.ts` va `apps/web/models/Proposal.ts` hien import lai model tu `@gr2/shared`.

Schema/collection quan trong:

- `tokens`: token metadata, `symbol`, `name`, `address`, `canonicalKey`, `chain`, `coingeckoId`, `aliases`, `type`, `priceUsd`, `priceUpdatedAt`.
- `token_prices`: gia moi nhat theo `tokenKey`, ref `token`, `priceUsd`, `source`, `lastUpdated`.
- `token_price_history`: lich su gia dung cho rolling metrics/backtest.
- `signals`: ket qua Quant V3, gom `tokenSymbol`, `tokenAddress`, `signalKey`, `detectedAt`, `sources`, `sentimentType`, `suggestionType`, `quantScore`, `confidence`, `uncertaintyEntropy`, `realizedVolatility`, `signalMode`, `status`.
- `proposals`: ket qua Layer3, lien ket `signalId`, action/suggestion, rationale AI, source, execution status, expiresAt, backtest fields, legacy compatibility fields.
- `rolling_metrics`: return, volatility, correlation/beta voi BTC, market regime.
- `source_weights` va `signal_weights`: trong so dong cho nguon/tin hieu.
- `backtest_runs`, `backtest_results`, `backtest_candidates`, `hyperparameter_configs`: metadata cho backtest/HPO/model health.
- `users`, `user_balances`, `perp_positions`, `transactions`, `portfolio_snapshots`: du lieu nguoi dung/portfolio/trade.
- `news_articles`, `news_sites`, `tweets`, `x_accounts`: du lieu nguon tin.

Diem dang chu y:

- Shared dang dung Mongoose model cache de tranh tao model trung lap.
- `signals` co unique partial index tren `signalKey`, giup quant upsert theo bucket.
- `signals` va `proposals` deu co truong back-compatible vi FE va du lieu cu van doc mot so field legacy.

### 3.2 `core/x-scaper`

Package crawl X/Twitter bang Selenium.

Thanh phan:

- `src/process.ts`: entry point `processXScraping()`, kiem tra env credential va chay single account hoac batch.
- `src/scraper.ts`: class `XScraper`, quan ly Chrome headless, login, cookie, scrape account, parse metric K/M, luu tweet.
- `src/db.ts`: repository helper cho X accounts/tweets.
- `cookies/x-scraper_cookies.json`: cookie cache de tranh login lai lien tuc.

Env chinh:

- `X_SCRAPER_EMAIL` hoac `X_EMAIL`
- `X_SCRAPER_PASSWORD` hoac `X_PASSWORD`
- `X_SCRAPER_USERNAME` hoac `X_USERNAME`

Ket qua luu vao:

- `tweets`
- `x_accounts`

Tinh chat:

- Neu thieu credential, scraper return fail graceful.
- Cron master co logic optional: neu X scraper loi, pipeline co the tiep tuc cac buoc sau.
- Selenium co rui ro checkpoint/anti-bot cua X.

### 3.3 `core/news-scraper`

Package crawl tin tuc crypto.

Thanh phan:

- `src/process.ts`: entry point `processNewsScraping()`.
- `src/scraper.ts`: `NewsScraper`, ho tro RSS, Cheerio HTML fallback, Firecrawl Map/Scrape.
- `src/db.ts`: load/save news sites, articles, tokens.

Nguon discovery:

- RSS neu site co khai bao `rss`.
- Cheerio HTML fallback neu RSS rong.
- Firecrawl Map fallback khi can.

Xu ly noi dung:

- Clean title/header/footer/menu/ads/newsletter.
- Loai static file, AMP, tag, author, price pages.
- Detect token symbol/name trong article bang matcher build tu `tokens`.
- Cache RSS trong `.cache/rss` de bo qua discovery neu top RSS khong doi.

Env chinh:

- `FIRECRAWL_API_KEY`
- `NEWS_MAX_ARTICLES_PER_SITE`
- `NEWS_SCRAPE_CONCURRENCY`
- `NEWS_ALWAYS_FIRECRAWL_MAP`
- `NEWS_STOP_AT_FIRST_EXISTING`
- `NEWS_FIRECRAWL_MAX_DISCOVER`
- `NEWS_RECENT_DAYS`

Ket qua luu vao:

- `news_articles`
- doc token symbols duoc gan vao metadata/article theo logic scraper.

### 3.4 `core/token-price-fetcher`

Package quan ly token list, gia hien tai va lich su gia.

Thanh phan:

- `src/process.ts`: `processTokenPrices()`, cap nhat toan bo token hoac lay gia token cu the.
- `src/services/token-list-service.ts`: import top coins tu CoinGecko, lay platform addresses, upsert `tokens`.
- `src/services/token-price-service.ts`: fetch gia tu CoinGecko, update `token_prices`, backfill `token_price_history`.
- `src/services/providers/coingecko.provider.ts`: provider CoinGecko.
- `src/services/providers/jupiter.provider.ts`, `token-registry.provider.ts`: provider bo tro cho token Solana.
- `scripts/backfill-token-price-history.ts`: backfill lich su gia theo days/interval/retry/skip-existing.

Scripts:

- `dev`: chay server.
- `dev:cron`: chay server co cron.
- `backfill:history`
- `backfill:history:1d`
- `backfill:demo`
- `build`

Ket qua luu vao:

- `tokens`
- `token_prices`
- `token_price_history`

Diem dang chu y:

- Token resolver uu tien `coingecko:` key khi can gia.
- Backfill co concurrency, retry, skip-existing va recent token hints tu proposals/signals.
- Portfolio FE phu thuoc vao token mapping va `token_prices`; neu thieu mapping/gia se tra `MISSING_PRICE`.

### 3.5 `core/research`

Day la lop nghien cuu, backtest va metric de cai thien quant.

Modules chinh:

- `services/rolling-metrics-service.ts`: tinh return, volatility, corrToBtc, betaToBtc cho token theo window, bucket price series, classify market regime.
- `services/regime-service.ts`: doc `rolling_metrics` moi nhat de lay regime hien tai va confidence.
- `services/dynamic-weight-service.ts`: tinh source weights bang tuong quan giua signal score va forward return theo source.
- `services/job-lock.ts`: lock job neu can tranh chay chong.
- `backtest/*`: engine replay/evaluate PnL, trade math, walk-forward, hyperparameter grid.
- `jobs/*`: entry scripts cho backtest, dynamic weight, maintenance, regime, rolling metrics.

Rolling metrics:

- Dung `token_price_history`.
- Bucket price theo interval.
- Align returns token voi BTC/WBTC.
- Tinh `corrToBtc`, `betaToBtc`, `returnPct`, `returnVol`.
- Classify regime: `stress`, `risk_on`, `defensive`, `rotation`, `mixed`.

Dynamic source weights:

- Lay signals trong window.
- Lay gia entry/exit tai horizon.
- Tinh Pearson correlation giua signalScore va forwardReturn.
- Cap nhat uy tin cua news host hoac Twitter author.

Backtest/PnL:

- `pnl-evaluator.ts` tinh PnL theo direction BUY/SELL/HOLD mapping, fee, slippage, notional.
- Tim price pair gan detectedAt va expiresAt/horizon.
- Skip khi thieu gia, distance qua xa, gross move bat thuong.
- Tra win/loss/breakeven, total PnL, win rate, drawdown.

### 3.6 `core/signal-detector`

Package phat hien tin hieu Quant V3.

Thanh phan:

- `scripts/run-quant.ts`: entry point doc DB, dung watermark, load news/tweets/tokens/history/rolling beta, chay engine, upsert `signals`.
- `src/quant-engine.ts`: orchestration 3 stage.
- `src/document-processor.ts`: cham tung document.
- `src/token-aggregator.ts`: gom document theo token va normalize volume/source.
- `src/alpha-analyzer.ts`: danh gia alpha, cross-token z-score, threshold/action/confidence.
- `src/finbert.ts`: sentiment/model layer.
- `src/services/hyperparam-config-service.ts`: load active hyperparams.
- `src/services/sentiment-cache-service.ts`: cache sentiment.
- `src/db-mapper.ts`: legacy mapper/save helper.

Luồng Quant V3:

1. Doc `news_articles` theo `scrapedAt` va `tweets` theo `tweetTime` tu watermark den `inputTo`.
2. Doc `tokens` type `coin/spl`.
3. Doc `x_accounts` de tinh author weight bang follower count.
4. Doc past `signals` 7 ngay de tao historicalData theo token.
5. Doc rolling beta/regime moi nhat tu `rolling_metrics`.
6. `detectSignalWithFinBertQuant()`:
   - Document scoring.
   - Token aggregation/normalization.
   - Alpha/cross evaluation.
7. Upsert vao `signals` theo `signalKey = symbol:bucket:signalMode`.
8. Cap nhat watermark `job_state.quant-input-watermark`.

Signal lifecycle:

- Moi tao: `status = RAW`.
- Layer3 claim: `PROCESSING`.
- Layer3 sinh proposal xong: `PROCESSED`.
- Loi validation/retry qua gioi han: `FAILED`.

### 3.7 `core/layer3`

Package Layer 3 bang LangGraph + Gemini, chịu trách nhiệm sinh proposal và diễn giải khuyến nghị.

Thanh phan:

- `src/workflow.ts`: claim RAW signals, enrich source content, invoke graph, upsert proposals, cap nhat status signal.
- `src/agent.ts`: LangGraph voi node `reasoning`, goi Gemini `gemini-2.5-flash`.
- `src/state.ts`: shape state cho proposal.
- `scripts/run-layer3.ts`: entry point chay workflow.
- `tests/generate-proposal.test.ts`: test proposal generation.

Workflow:

1. Claim signal `RAW` hoac `PROCESSING` stale bang `findOneAndUpdate`.
2. Validate bat buoc: `_id`, `tokenSymbol`, `tokenAddress`, `suggestionType`, `sentimentType`.
3. Enrich source:
   - `News Article`: lay content/summary tu `news_articles`.
   - `X (Twitter)`: lay text/content tu `tweets`, clean link `t.co`.
4. Tao `ProposalState`.
5. Invoke `layer3Graph`.
6. Upsert `proposals` theo `signalId`, copy quant fields, score components, source, expiresAt, rationale.
7. Mark signal `PROCESSED`.

AI behavior:

- Prompt tieng Viet.
- Yeu cau mot doan van duy nhat, khang dinh BUY/SELL/HOLD, trich Z-score/confidence, lien he tin tuc/X voi diem quant.
- Neu confidence <= 40%, them canh bao cold start.
- Can `GOOGLE_API_KEY` hoac `GOOGLE_API_KEY_PROPOSAL`.

### 3.8 `core/run`

Package orchestration pipeline bang cron.

Thanh phan:

- `src/index.ts`: MasterCron.

Mac dinh:

- Cron expression: `0 0,12 * * *`.
- Timezone: `Asia/Ho_Chi_Minh`.
- Co `PIPELINE_RUN_ON_START` de chay ngay khi start.
- Co lock Mongo collection `job_locks`, lock id `master-cron-pipeline`, TTL mac dinh 180 phut.

Pipeline steps:

1. X scraper, optional neu du credential hoac `RUN_X_SCRAPER=true`.
2. News scraper, optional.
3. Rolling metrics.
4. Regime.
5. Dynamic source weights.
6. Quant signal.
7. Layer3 proposal.
8. Backtest outcome 12h.

Diem tot:

- Co in-process `isRunning` va distributed Mongo lock de tranh chay chong.
- Optional steps cho scraper giup pipeline khong dung toan bo khi nguon crawl loi.
- Heartbeat refresh lock trong luc pipeline dai.

## 4. Frontend `apps/web`

Frontend la Next.js 14 App Router, React 18, Tailwind CSS, SWR, Solana wallet adapter, lucide-react, sonner, recharts.

### 4.1 App Structure

Pages hien tai:

- `/`: wallet login page.
- `/onboarding`: tao/cap nhat ho so sau khi login.
- `/overview`: dashboard tong quan.
- `/portfolio`: holdings, investments, watchlist.
- `/profile`: thong tin nguoi dung.
- `/signals`: danh sach signal.
- `/signals/daily`: tin hieu theo ngay.
- `/signals/[id]`: chi tiet signal.
- `/signals/[id]/explanation`: giai thich signal.
- `/proposal/[id]`: chi tiet proposal.
- `/proposal/[id]/explanation`: giai thich diem/logic.
- `/proposal/[id]/scenario`: scenario + price history chart.
- `/proposal/[id]/trade`: demo trade execute.
- `/recommendations`: khuyen nghi.
- `/opportunities`: co hoi.
- `/opportunities/[id]`: chi tiet co hoi.
- `/positions`: vi the dang mo.
- `/positions/[id]`: chi tiet vi the.
- `/watchlist`: theo doi.
- `/alerts`: canh bao.
- `/diagnostics`: chan doan.
- `/model-health`: trang thai model/backtest/hyperparams.
- `/data-check`: kiem tra du lieu.
- `/tokens/[symbol]`: chi tiet token.

Layout root:

- `WalletContextProvider`
- `AuthProvider`
- `TradingDemoProvider`
- `ErrorBoundary`
- `Toaster`
- Global dark theme, Inter font, Solana wallet CSS.

Navigation:

- `Navbar` sticky top.
- Nav items: Tong quan, Danh muc, Chan doan, Khuyen nghi, Co hoi, Theo doi, Vi the, Canh bao, Mo hinh.
- User area hien avatar chu cai, wallet short address, logout.

### 4.2 Design/UI Layer

UI hien theo phong cach dark/cyber:

- `globals.css` va Tailwind config tao tokens mau nen/border/primary.
- `glass-card`, gradient purple/cyan, dark background.
- Shared components trong `app/components/shared/NdlUi.tsx`:
  - `PageHeader`
  - `MetricCard`
  - `DataSkeleton`
  - `EmptyState`
  - `CountdownBadge`
  - `DataQualityBadge`
  - `ProposalCard`
  - `SignalCard`
  - `HoldingRow`
  - `SourceList`
  - `MiniStat`

UI primitive:

- `badge`, `button`, `input`, `label`, `skeleton`, `slider`, `sonner`, `tabs`.

### 4.3 Auth Va Wallet

Auth flow:

1. User connect Phantom wallet tren `/`.
2. FE goi `POST /api/auth/nonce` voi wallet address.
3. Server tao nonce, message, luu hash nonce vao `wallet_auth_nonces`.
4. Wallet sign message bang `signMessage`.
5. FE goi `POST /api/auth/verify` voi walletAddress, message, signature bs58.
6. Server verify ed25519 signature voi public key Solana.
7. Server consume nonce, tao session token, hash token luu vao `auth_sessions`.
8. Server set httpOnly cookie `ndl_session`.
9. FE hydrate session bang `GET /api/auth/verify`.
10. Logout goi `/api/auth/logout`, clear cookie va disconnect wallet.

Server helper:

- `apps/web/server/auth/walletAuth.ts`
- `AUTH_COOKIE_NAME = ndl_session`
- Nonce TTL: 5 phut.
- Session TTL: 7 ngay.
- Co `requireSessionUser()` cho protected API.

Diem dang chu y:

- Wallet network dang fix `Devnet`.
- `WalletProvider` disable `autoConnect` de tranh hydration/loop.
- `suppressHydrationWarning` duoc dat o root do wallet extension co the chen code.

### 4.4 API Routes

#### Auth/User

- `POST /api/auth/nonce`: tao wallet auth nonce.
- `GET /api/auth/verify`: hydrate session hien tai.
- `POST /api/auth/verify`: verify signature va tao session.
- `POST /api/auth/logout`: revoke/clear session.
- `POST /api/user/create`: tao user.
- `GET /api/user/profile`: lay profile.
- `PUT/PATCH /api/user/update`: cap nhat profile.

#### Signals

- `GET /api/signals`
  - Query: `limit`, `type`, `cursor`, `meta=1`.
  - Cache in-memory ngan 10 giay cho latest query khong cursor.
  - Doc signals qua `SignalService.getSignals`.
  - Aggregate proposal moi nhat theo `signalId`.
  - Enrich signal voi:
    - `expiresAt`
    - `lifecycleState`
    - `confidenceBreakdown`
    - `enrichedProposal`
    - `backtest`
    - `layerConflict`
    - `rationaleBadges`
  - Co cursor base64url theo `detectedAt` va id.

- `GET /api/signals/[id]`
  - Lay signal theo ObjectId.
  - Normalize `detectedAt`, `expiresAt`, `uncertaintyEntropy`, `realizedVolatility`.

#### Proposals

- `GET /api/proposals`
  - Lay proposals active/pending/executed.
  - Sort moi nhat, limit 20.
  - Normalize action, confidence, ROI, expiresAt, status.

- `GET /api/proposals/[id]`
  - Tim by `_id`.
  - Fallback theo `triggerEventId`, `triggerSignalId`, `signalId`.
  - Neu khong co proposal nhung id la signal, tra response `signal-only`.
  - Normalize financial impact, backtest semantics, layer conflict, signal health, volatility.

- `POST /api/proposals/[id]/decision`
  - Xu ly quyet dinh proposal.

- `GET /api/proposals/[id]/score-explanation`
  - Tra formula, thresholds, score components, audit trail.

- `GET /api/proposals/[id]/timeline`
  - Tra price history, current/historical proposal markers, backtest results.

#### Portfolio/Trade

- `GET /api/portfolio`
  - Protected bang wallet session.
  - Lay user theo wallet.
  - Resolve balances qua core `resolveToken`.
  - Join `tokens`, `token_prices`.
  - Tra holdings voi dataQuality `OK` hoac `MISSING_PRICE`.
  - Lay open `perp_positions`.
  - Tra watchlist/proposals.
  - Tinh stats: totalValue, priced/missing holdings, active/watchlist count.

- `POST /api/trade/execute`
  - Protected bang wallet session.
  - Demo execution, khong gui transaction on-chain.
  - Validate proposal executable.
  - Tao `trade_executions`.
  - Tao `perp_positions` status `open`.
  - Update proposal `EXECUTED`.
  - Dung Mongo transaction.
  - Gioi han leverage toi da 10.

#### Model/Diagnostics

- `GET /api/model-health`
  - Lay active hyperparameter config production.
  - Lay latest HPO backtest run.

- `/api/seed`, `/api/context.md`, `/api/flow.md` la route/doc bo tro.

### 4.5 Client Data Hooks

Hooks chinh:

- `hooks/useData.ts`: SWR simple cho signals/proposal/signal detail.
- `lib/hooks/useNdlData.ts`: hook tong hop portfolio, proposals, signals, model health va cac type UI.
- `lib/hooks/useSignals.ts`: stateful polling 30s, ho tro demo mode `NEXT_PUBLIC_DEMO_MODE=true`.
- `lib/hooks/useProposals.ts`: stateful polling 30s, demo mode.
- `lib/hooks/usePortfolio.ts`: hook cu con dung mock trades, comment TODO thay bang real `/api/portfolio`.
- `lib/hooks/useTokenPrices.ts`, `useSignalAnalytics.ts`: hook bo tro cho gia/analytics.

Data strategy hien tai la ket hop:

- SWR cho cac data resource can cache/revalidate.
- Manual `useEffect + setInterval` cho hooks cu/demo-friendly.
- API route server-side normalize du lieu truoc khi FE render.

### 4.6 Models Phia Web

`apps/web/models/Signal.ts` va `apps/web/models/Proposal.ts` da duoc chuyen thanh compatibility adapter:

- `SignalModel = signalsTable` tu `@gr2/shared`.
- `Proposal = proposalsTable` tu `@gr2/shared`.

`apps/web/models/User.ts` van la schema rieng phia web cho collection `users`, gom:

- `walletAddress`
- profile fields: `name`, `email`, `age`, `riskTolerance`, `tradeStyle`
- portfolio fields: `totalAssetUsd`, `cryptoInvestmentUsd`, `balances`
- `notificationEnabled`, `role`

### 4.7 Mock/Demo Layer

Du an co nhieu diem demo/mock:

- `NEXT_PUBLIC_DEMO_MODE=true` trong hooks signals/proposals se dung `lib/demo/mockScenario`.
- `services/mockApi.ts` tra mock price history, trade preview, alerts, watchlist.
- `lib/hooks/usePortfolio.ts` van dung mock trades/stats.
- `/api/trade/execute` tao demo fill va `txHash = demo:<executionId>`.

Dieu nay phu hop demo san pham, nhung can phan biet ro voi production trading.

## 5. Data Model Va Lifecycle

### 5.1 Token Identity

Token co the duoc nhan dien qua:

- Mongo `_id`
- `address`
- `primaryAddress`
- `coingeckoId`
- `coingecko:<id>`
- `canonicalKey`
- `aliases`: mint/address/coingecko/priceKey/symbol/native

`resolveToken()` la diem dung chung de giam loi map token giua core va FE.

### 5.2 Signal

Signal dai dien cho ket qua Quant.

Field quan trong:

- `tokenSymbol`, `tokenAddress`
- `signalKey`
- `detectedAt`, `expiresAt`
- `sources`
- `sentimentType`, `suggestionType`
- `quantScore`, `confidence`
- `uncertaintyEntropy`, `realizedVolatility`
- `signalMode`: `COLD_START` hoac `NORMALIZED_ALPHA`
- `metadata.scoreComponents`
- `status`: `RAW`, `PROCESSING`, `PROCESSED`, `FAILED`

Lifecycle:

```text
Quant creates/upserts signal -> RAW
Layer3 claims signal -> PROCESSING
Layer3 writes proposal -> PROCESSED
Validation/AI failure -> FAILED
```

### 5.3 Proposal

Proposal la ban giai thich/action layer phia tren signal.

Field quan trong:

- `signalId`
- `tokenSymbol`, `tokenAddress`
- `suggestionType`, `sentimentType`
- `quantScore`, `confidence`
- `scoreComponents`
- `rationaleSummary`
- `sources`
- `executionStatus`: `PENDING`, `EXECUTED`, `IGNORED`
- `expiresAt`
- Backtest: `entryPrice`, `exitPrice`, `actualPnL`, `winLossStatus`, `pnlPercentage`, `backtestedAt`, `backtestMeta`
- Compatibility: `action`, `title`, `summary`, `reason`, `financialImpact`, `analysis`, `status`

### 5.4 Portfolio/Trade

Nguoi dung:

- Auth bang wallet.
- `users.balances` luu token balance.
- Portfolio API resolve token/gia de tinh holding value.

Trade demo:

- `trade_executions`: execution record.
- `perp_positions`: open position record.
- Proposal update sang `EXECUTED`.

## 6. End-to-End Flow

### 6.1 Data Ingestion

```text
X accounts -> x-scaper -> tweets
News sites -> news-scraper -> news_articles
CoinGecko/Jupiter -> token-price-fetcher job rieng -> tokens/token_prices/token_price_history
```

### 6.2 Research Metrics

```text
token_price_history -> rolling_metrics
signals + token_price_history + news_articles -> source_weights
rolling_metrics -> current market regime
```

### 6.3 Quant Signal

```text
news_articles + tweets + tokens + past signals + rolling beta/regime
        -> document scoring
        -> token aggregation
        -> alpha/cross evaluation
        -> signals
```

### 6.4 Layer3 Proposal

```text
signals RAW
        -> claim PROCESSING
        -> enrich source content
        -> Gemini rationale
        -> proposals upsert
        -> signals PROCESSED
```

### 6.5 Backtest Outcome

```text
proposals/signals + token_price_history
        -> nearest entry/exit price
        -> fee/slippage/notional PnL
        -> win/loss/breakeven
        -> proposal backtest fields
```

### 6.6 FE Consumption

```text
Next.js API routes
        -> normalize/enrich data
        -> SWR/hooks
        -> dashboard cards/pages
```

## 7. Cau Hinh Moi Truong

Env duoc doc tu nhieu workspace `.env`. Nhung bien quan trong:

Database:

- `MONGODB_URI`
- `DATABASE_URL` fallback trong shared connection.

AI:

- `GOOGLE_API_KEY`
- `GOOGLE_API_KEY_PROPOSAL`
- `LAYER3_MAX_OUTPUT_TOKENS`

X scraper:

- `X_EMAIL`
- `X_PASSWORD`
- `X_USERNAME`
- `X_SCRAPER_EMAIL`
- `X_SCRAPER_PASSWORD`
- `X_SCRAPER_USERNAME`

News scraper:

- `FIRECRAWL_API_KEY`
- `NEWS_MAX_ARTICLES_PER_SITE`
- `NEWS_SCRAPE_CONCURRENCY`
- `NEWS_ALWAYS_FIRECRAWL_MAP`
- `NEWS_STOP_AT_FIRST_EXISTING`
- `NEWS_FIRECRAWL_MAX_DISCOVER`
- `NEWS_RECENT_DAYS`

Pipeline:

- `PIPELINE_CRON`
- `PIPELINE_TIMEZONE`
- `PIPELINE_RUN_ON_START`
- `PIPELINE_LOCK_TTL_MINUTES`
- `PIPELINE_STEP_DELAY_MS`
- `RUN_X_SCRAPER`

Quant:

- `QUANT_LOOKBACK_MINUTES`
- `SIGNAL_KEY_BUCKET`
- `ROLLING_METRICS_WINDOW_HOURS`
- `ROLLING_METRICS_MAX_AGE_HOURS`

Frontend:

- `NEXT_PUBLIC_DEMO_MODE`
- `NEXT_PUBLIC_USE_MOCK_API`
- `NEXT_PUBLIC_ENABLE_DEBUG_PANEL`

## 8. Testing Va Quality

Da co test/config:

- `core/signal-detector/tests/quant-math.test.ts`
- `core/token-price-fetcher/tests/token-price-service.test.ts`
- `core/layer3/tests/generate-proposal.test.ts`
- Vitest configs trong mot so package.
- Root `.github/workflows/test-core-packages.yml`.

Scripts:

- Root `npm run test` chay `turbo run test`.
- `core/shared` co `test:connection`, `test:schemas`, `test:integrity`, `test:all`.
- `core/signal-detector` co `test`, `test-quant`.
- `core/layer3` co `test`.

Khoang trong:

- FE khong thay test UI/route ro rang trong source hien tai.
- Nhieu API route lam normalization phuc tap nhung chua co test regression.
- Portfolio/trade demo transaction nen can integration test neu muon len production.

## 9. Diem Manh Hien Tai

- Kien truc monorepo hop ly: core packages tach theo domain, FE rieng.
- `core/shared` dang tro thanh source of truth cho DB schema, giam duplicate model giua FE/core.
- Pipeline co cron orchestration, lock, heartbeat, optional scraper steps.
- Signal lifecycle co status va Layer3 locking, tranh xu ly trung.
- Quant pipeline co watermark, dynamic beta/regime, historical signals va hyperparams.
- FE API routes normalize du lieu kha ky, co fallback cho du lieu cu/signal-only.
- Auth wallet signature dung nonce one-time va httpOnly session cookie.
- Portfolio route da dung token identity resolver chung voi core.
- Backtest/PnL co fee/slippage/notional va skip data quality.

## 10. Rui Ro Va No Ky Thuat

### 10.1 Secrets va file sinh ra

Repo hien co nhieu `.env`, `.cache`, `.next`, `dist`, `node_modules` trong workspace. Can dam bao `.gitignore` va git hygiene tot vi:

- `.env` co the chua secret.
- Cookie X scraper la du lieu nhay cam.
- `.next/dist/node_modules` lam repo rat nhieu va de gay nhieu khi phan tich.

### 10.2 Ten package/thong nhat module

- `x-scaper` co typo "scaper" thay vi "scraper"; da duoc dung trong workspace nen khong nen doi tuy tien, nhung can ghi nho.
- Root dependencies co ca `turbo` version 2.6.1 trong devDependencies va 1.12.0 trong dependencies.
- Root TypeScript va workspace TypeScript versions khac nhau.

### 10.3 FE data layer con song song

Co nhieu hook lay cung loai du lieu:

- `hooks/useData.ts`
- `lib/hooks/useNdlData.ts`
- `lib/hooks/useSignals.ts`
- `lib/hooks/useProposals.ts`

Mot so hook dung SWR, mot so dung manual polling, mot so co demo fallback. Nen chuan hoa dan de tranh data shape lech.

### 10.4 Mock vs real production

- `/api/trade/execute` la demo fill, khong on-chain.
- `usePortfolio.ts` van mock trades.
- `services/mockApi.ts` co mock alerts/watchlist/price history.

Can gan nhan ro tren UI/API neu demo mode, tranh user hieu nham la lenh that.

### 10.5 Data shape compatibility

Signals/proposals dang giu nhieu field cu va moi:

- `volatilityFlag` vs `uncertaintyEntropy`
- `action` vs `suggestionType`
- `summary/title/reason` vs `rationaleSummary`
- `financialImpact.roi` vs `pnlPercentage`

API route da normalize, nhung core/FE can tiep tuc giam duplicate semantics.

### 10.6 Scraper reliability

- X Selenium co rui ro checkpoint, cookie expire, selector thay doi.
- News scraper phu thuoc RSS/HTML structure/Firecrawl va co nhieu heuristic clean content.
- Cac buoc scraper optional la hop ly, nhung pipeline quality phu thuoc data moi.

### 10.7 Backtest va price quality

- Backtest skip neu thieu price pair gan thoi diem.
- Portfolio co missing price khi token mapping/gia thieu.
- Token identity resolver la diem then chot; neu mapping sai se anh huong portfolio, backtest va signal display.

## 11. Huong Phat Trien De Xuat

Uu tien ngan han:

1. Chuan hoa data hooks FE quanh `useNdlData` hoac SWR resource hooks duy nhat.
2. Tach ro demo/prod trading: badge UI, env guard, API response flag.
3. Them test cho `/api/signals`, `/api/proposals/[id]`, `/api/portfolio`, `/api/trade/execute`.
4. Viet script audit token identity de bao token missing mapping/gia.
5. Lam sach generated artifacts khoi git/workspace neu chua can theo doi.

Uu tien trung han:

1. Tao typed DTO chung cho API response signals/proposals/portfolio.
2. Gom semantics normalization vao shared library thay vi lap lai o FE routes.
3. Them observability cho pipeline: collection run logs, latency per step, data counts, last successful run.
4. Them UI model-health chi tiet: active config, latest run, win rate, missing price rate, signal throughput.
5. Bo sung integration test voi Mongo test container/memory server cho core pipeline.

Uu tien dai han:

1. Replay historical news/tweet snapshots cho HPO dung nghia thay vi proposal-only backtest.
2. Thay trade demo bang integration layer on-chain/perp exchange co guard rails.
3. Them permission/user ownership ro cho proposals/watchlist/positions.
4. Chuan hoa schema migration va index management.
5. Them queue/job runner thay vi spawn npm step neu pipeline can scale.

## 12. Ban Do Thu Muc Nhanh

```text
.
|-- apps
|   `-- web
|       |-- app                 Next.js App Router pages + API routes
|       |-- app/components      layout, wallet, shared UI, primitives
|       |-- app/contexts        AuthContext, TradingDemoContext
|       |-- hooks               legacy/simple hooks
|       |-- lib                 API client, hooks, utils, types, demo data
|       |-- models              web models/adapters
|       |-- server/auth         wallet auth/session helpers
|       `-- services            SignalService, mock API
|-- core
|   |-- shared                  DB schemas, connection, resolver, utils
|   |-- x-scaper                X/Twitter Selenium scraper
|   |-- news-scraper            RSS/Cheerio/Firecrawl news scraper
|   |-- token-price-fetcher     token list, price current/history
|   |-- research                rolling metrics, regime, weights, backtest
|   |-- signal-detector         Quant V3 signal pipeline
|   |-- layer3                  LangGraph/Gemini Layer 3 proposal workflow
|   `-- run                     master cron/orchestrator
|-- scripts
|   `-- run-concurrent.mjs      helper run concurrent commands
|-- package.json                root workspace scripts
|-- turbo.json                  Turborepo tasks
`-- tsconfig.json               root TS config/path aliases
```

## 13. Cach Chay Nhanh

Setup dependencies da co `package-lock.json`; thong thuong:

```bash
npm install
```

Chay frontend:

```bash
npm --workspace @gr2/web run dev
```

Chay toan bo dev qua Turbo:

```bash
npm run dev
```

Chay core pipeline mot lan:

```bash
npm run pipeline:core
```

Chay pipeline scheduler:

```bash
npm run pipeline:scheduler
```

Chay tung buoc core:

```bash
npm run news
npm run prices:backfill:1d
npm run backtest:outcome
npm run metrics
npm run regime
npm run weights
npm run signal
npm --workspace @gr2/layer3 run layer3
```

Build/test:

```bash
npm run build
npm run test
```
