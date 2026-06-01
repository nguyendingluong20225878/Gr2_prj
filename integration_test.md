# Integration Test Suite

Scope: validate system behavior across module boundaries. These tests must run through package/script/API boundaries, not by calling individual helper functions.

System under test:

```text
X/news scraper -> quant detector -> Layer3 proposal generation -> MongoDB -> Next API
```

Primary files covered:

- `core/run/src/index.ts`
- `core/x-scaper/scripts/run-scraper.ts`
- `core/news-scraper/src/process.ts`
- `core/signal-detector/scripts/run-quant.ts`
- `core/layer3/scripts/run-layer3.ts`
- `core/layer3/src/workflow.ts`
- `apps/web/app/api/signals/route.ts`
- `apps/web/app/api/proposals/route.ts`

## Test Environment

- Use isolated MongoDB database, e.g. `gr2_integration_test`.
- Seed collections directly through DB fixtures only: `tokens`, `tweets`, `news_articles`, `x_accounts`, `source_weights`, `signals`, `proposals`, `job_locks`.
- Mock external systems at process/network boundary:
  - X login/scraper network.
  - FinBERT API.
  - Gemini/Layer3 LLM API.
  - CoinGecko or price provider if the API path requires price enrichment.
- Do not mock internal functions such as alpha analyzer, document processor, workflow, or API mapping.
- Run pipeline stages through their real scripts:
  - `npx tsx core/news-scraper/scripts/run-news-scraper.ts`
  - `npx tsx core/signal-detector/scripts/run-quant.ts`
  - `npx tsx core/layer3/scripts/run-layer3.ts --limit=10`
  - Master pipeline through `core/run/src/index.ts` with cron trigger controlled by fake timer or a test-only immediate trigger.
- Run API validation through HTTP against the Next app, not by importing route handlers directly.

## Test Data Baseline

Seed tokens:

```json
[
  { "symbol": "BTC", "name": "Bitcoin", "type": "coin" },
  { "symbol": "ETH", "name": "Ethereum", "type": "coin" },
  { "symbol": "SOL", "name": "Solana", "type": "coin" },
  { "symbol": "IN", "name": "Inside", "type": "coin" }
]
```

Seed x accounts:

```json
[
  { "_id": "acct_large", "username": "large_kol", "followerCount": 1000000 },
  { "_id": "acct_small", "username": "small_kol", "followerCount": 1000 }
]
```

Seed valid raw data:

- Tweet from `acct_large`: `"$SOL volume breakout after Solana ecosystem activity"` with recent `tweetTime`.
- News article: title `"Ethereum ETF inflows rise"`, content mentions `"ETH"` and `"Ethereum"`.
- Noise article: title `"Bitcoin ETF inflows rose in May"`, content contains lowercase `"in"` but does not mention token `IN`.

Mock external responses:

- FinBERT returns positive score for SOL/ETH documents.
- Gemini returns deterministic proposal rationale with `suggestionType = BUY`, `executionStatus = PENDING`.

## Test Case 1: End-to-end pipeline creates proposal and exposes it through APIs

- Mục tiêu: Validate full flow scraper/source data -> quant -> Layer3 -> proposal -> API.
- Setup:
  - Seed baseline tokens, x accounts, tweets, and news.
  - Configure FinBERT mock success.
  - Configure Gemini mock success.
  - Set `RUN_X_SCRAPER=false` so test uses seeded tweet/news data and avoids live X.
- Steps:
  1. Run `npx tsx core/signal-detector/scripts/run-quant.ts`.
  2. Assert MongoDB `signals` contains at least one `RAW` signal for `SOL` or `ETH`.
  3. Run `npx tsx core/layer3/scripts/run-layer3.ts --limit=10`.
  4. Start Next app against test DB.
  5. Call `GET /api/signals?limit=20`.
  6. Call `GET /api/proposals`.
- Expected:
  - Quant creates signal with `tokenSymbol`, `quantScore`, `confidence`, `sources`, `detectedAt`, `status`.
  - Layer3 creates proposal with matching `signalId`, `tokenSymbol`, `quantScore`, `confidence`, `rationaleSummary`, `executionStatus`.
  - Original signal status becomes `PROCESSED`.
  - `/api/signals` returns the signal with `enrichedProposal`.
  - `/api/proposals` returns proposal action from stored action/suggestionType, not inferred from title.
- Result: To be executed in integration environment.

## Test Case 2: News scraper false-positive does not poison downstream quant

- Mục tiêu: Validate end-to-end token detection boundary for short ticker false-positive.
- Setup:
  - Seed token `IN`.
  - Seed noise article `"Bitcoin ETF inflows rose in May"` with no uppercase `IN`, no `$IN`, no token name.
  - FinBERT mock returns positive score for the article if called.
- Steps:
  1. Run news scraper/process stage or insert article exactly as scraper would store it.
  2. Run quant detector.
  3. Query `signals` for `tokenSymbol = "IN"`.
- Expected:
  - No `IN` signal is generated from lowercase `"in"`.
  - No proposal is generated for `IN`.
  - `/api/signals` and `/api/proposals` do not expose `IN` from this noise article.
- Result: To be executed in integration environment.

## Test Case 3: Signal update after PROCESSED inserts new RAW signal instead of mutating proposal source

- Mục tiêu: Validate data consistency between signal and proposal after intraday updates.
- Setup:
  - Seed an existing `signals` document for `SOL`:
    - `status = PROCESSED`
    - `createdAt >= startOfDay`
    - `detectedAt = T1`
    - `quantScore = 1.2`
  - Seed matching `proposals` document with `signalId` pointing to that processed signal and `quantScore = 1.2`.
  - Seed newer SOL tweet/news that should produce `quantScore != 1.2`.
- Steps:
  1. Run quant detector.
  2. Query all `signals` for `SOL` created today.
  3. Query existing proposal by old `signalId`.
  4. Run Layer3.
  5. Query proposals again.
- Expected:
  - Old `PROCESSED` signal is not overwritten.
  - Old proposal remains consistent with old signal values.
  - New signal is inserted with `status = RAW`, new `detectedAt`, updated score/source metadata.
  - After Layer3, a separate proposal exists for the new signal.
  - No proposal points to a signal whose `quantScore`, `detectedAt`, or `signalMode` was overwritten after processing.
- Result: To be executed in integration environment.

## Test Case 4: API signal/proposal consistency after Layer3 enrichment

- Mục tiêu: Validate API exposes synchronized Layer2/Layer3 metadata.
- Setup:
  - Complete Test Case 1 or seed a processed signal and matching proposal.
  - Proposal includes `volatilityFlag`, `uncertaintyEntropy`, `realizedVolatility`, `scoreComponents`, `signalMode`.
- Steps:
  1. Call `GET /api/signals?limit=20`.
  2. Locate the processed signal.
  3. Compare `signal.enrichedProposal` fields with MongoDB proposal document.
- Expected:
  - `enrichedProposal.tokenSymbol` equals signal `tokenSymbol`.
  - `enrichedProposal.quantScore` equals proposal `quantScore`.
  - `enrichedProposal.uncertaintyEntropy`, `realizedVolatility`, `scoreComponents`, and `volatilityFlag` match proposal.
  - `layerConflict` reflects actual difference between signal suggestion and proposal action.
  - Missing proposal does not crash API; signal is returned without `enrichedProposal`.
- Result: To be executed in integration environment.

## Test Case 5: Missing X credentials do not stop quant and Layer3

- Mục tiêu: Validate failure scenario for missing credential.
- Setup:
  - Unset `X_EMAIL`, `X_PASSWORD`, `X_USERNAME`.
  - Ensure `RUN_X_SCRAPER` is unset or not `"true"`.
  - Seed recent tweets/news directly in DB.
  - Mock FinBERT and Gemini success.
- Steps:
  1. Trigger master pipeline once.
  2. Capture logs.
  3. Query `signals` and `proposals`.
- Expected:
  - Log contains skip/warn for X scraper missing credential.
  - Quant still runs.
  - Layer3 still runs.
  - Signals/proposals are created from existing DB data.
  - Pipeline releases `job_locks` after completion.
- Result: To be executed in integration environment.

## Test Case 6: Forced X scraper failure does not stop quant and Layer3

- Mục tiêu: Validate external API/process failure isolation.
- Setup:
  - Set `RUN_X_SCRAPER=true`.
  - Set fake X credentials.
  - Mock `run-scraper.ts` process/network to exit non-zero.
  - Seed recent tweets/news directly in DB so quant has data.
- Steps:
  1. Trigger master pipeline once.
  2. Capture logs and process exit status.
  3. Query `signals` and `proposals`.
- Expected:
  - X scraper failure is logged as stage 1 failure.
  - Master pipeline does not abort before quant.
  - Quant and Layer3 still complete.
  - Process does not exit with fatal code solely due to scraper failure.
- Result: To be executed in integration environment.

## Test Case 7: FinBERT API failure does not corrupt signal/proposal state

- Mục tiêu: Validate API fail scenario at quant scoring boundary.
- Setup:
  - Seed valid tweets/news and tokens.
  - Configure FinBERT mock to timeout or return 500 for all scoring calls.
  - Ensure no pre-existing `RAW` signal for seeded token.
- Steps:
  1. Run quant detector.
  2. Query `signals`.
  3. Run Layer3.
  4. Query `proposals`.
- Expected:
  - Quant handles scoring failures without writing malformed `NaN` scores.
  - Signals are either not created or created only with finite safe fallback values, depending on intended product behavior.
  - No proposal is generated from a signal with non-finite `quantScore`, missing `tokenSymbol`, or empty source context.
  - Errors are logged with enough context to identify FinBERT failure.
- Result: To be executed in integration environment.

## Test Case 8: Gemini/Layer3 API failure leaves signal retryable

- Mục tiêu: Validate Layer3 external API failure.
- Setup:
  - Seed one valid `RAW` signal with valid source references.
  - Configure Gemini mock to return 500 or timeout.
- Steps:
  1. Run `npx tsx core/layer3/scripts/run-layer3.ts --limit=10`.
  2. Query signal by `_id`.
  3. Query proposals by `signalId`.
  4. Restore Gemini mock success and rerun Layer3.
- Expected:
  - First run does not create incomplete proposal.
  - Signal remains retryable, preferably `RAW`, or is marked with explicit failure state if such status exists.
  - Second run creates proposal successfully.
  - Signal is marked `PROCESSED` only after proposal write succeeds.
- Result: To be executed in integration environment.

## Test Case 9: MongoDB write failure prevents checkpoint/data loss

- Mục tiêu: Validate DB fail scenario for ingestion and pipeline consistency.
- Setup:
  - Configure MongoDB proxy/mock to fail `insertMany` for X tweets with a non-duplicate error.
  - Seed account checkpoint `lastTweetUpdatedAt = T0`.
  - Provide scraped tweets newer than `T0`.
- Steps:
  1. Run X scraper stage.
  2. Query account checkpoint.
  3. Query tweets collection.
  4. Restore DB writes and rerun scraper.
- Expected:
  - On non-duplicate DB failure, checkpoint does not advance.
  - Tweets are retried on next run.
  - Duplicate-only errors are tolerated and can advance checkpoint.
  - No downstream quant signal is created from tweets that were never persisted.
- Result: To be executed in integration environment.

## Test Case 10: Master pipeline DB outage releases in-process state cleanly

- Mục tiêu: Validate master pipeline behavior when DB fails after startup.
- Setup:
  - Start master pipeline against test DB.
  - Force DB error during quant or Layer3 stage.
- Steps:
  1. Trigger pipeline once.
  2. Wait for failure handling.
  3. Restore DB.
  4. Trigger pipeline again.
- Expected:
  - First run logs failure and reaches `finally`.
  - `isRunning` does not remain stuck forever.
  - `job_locks` is released if owner was acquired.
  - Second run can acquire lock and proceed.
- Result: To be executed in integration environment.

## Test Case 11: Concurrent master pipelines only allow one active runner

- Mục tiêu: Validate distributed lock under simultaneous runs.
- Setup:
  - Use one shared test MongoDB.
  - Start two master pipeline processes at the same time.
  - Make quant stage slow enough to keep first process active.
- Steps:
  1. Trigger both processes concurrently.
  2. Query `job_locks` during execution.
  3. Count signal/proposal writes.
  4. Inspect logs from both processes.
- Expected:
  - Only one process acquires `master-cron-pipeline` lock.
  - Second process logs that lock belongs to another process and skips.
  - No duplicate signals/proposals are created from the same raw data due to concurrent master runs.
  - Lock is released by active process after completion.
- Result: To be executed in integration environment.

## Test Case 12: Long-running pipeline refreshes lock and blocks stale takeover

- Mục tiêu: Validate lock heartbeat for pipeline longer than TTL.
- Setup:
  - Set test clock or reduce `LOCK_TTL_MS` in test build to a short value.
  - Make first pipeline run longer than TTL through delayed mocked scraper/quant/Layer3 stage.
  - Start second process after original TTL would have expired.
- Steps:
  1. Start process A and acquire lock.
  2. Wait beyond original TTL while heartbeat runs.
  3. Start process B.
  4. Query `job_locks.lockedAt` repeatedly.
- Expected:
  - Process A periodically updates `lockedAt`.
  - Process B does not acquire lock while A heartbeat is active.
  - Process B skips instead of running parallel pipeline.
  - After A finishes, lock is released.
- Result: To be executed in integration environment.

## Test Case 13: Stale lock recovery works after process death

- Mục tiêu: Validate concurrency recovery boundary.
- Setup:
  - Insert `job_locks` document:
    - `_id = "master-cron-pipeline"`
    - `lockedAt` older than TTL
    - `releasedAt = null`
    - `owner = "dead-process"`
- Steps:
  1. Start master pipeline process.
  2. Trigger pipeline once.
  3. Query `job_locks`.
- Expected:
  - New process acquires stale lock.
  - `owner` changes to new process owner.
  - Pipeline runs normally.
  - Lock releases after completion.
- Result: To be executed in integration environment.

## Test Case 14: Finite history count drives cold-start behavior through full quant output

- Mục tiêu: Validate history data consistency at integration level, not alpha helper unit level.
- Setup:
  - Seed historical `signals` for `SOL` from last 7 days:
    - two documents with finite `metadata.scoreComponents.unifiedRaw`
    - three documents with `NaN`, `null`, missing, or non-numeric raw values
  - Seed current SOL tweet/news strong enough to generate a signal.
- Steps:
  1. Run quant detector.
  2. Query latest SOL signal.
  3. Run Layer3.
  4. Query matching proposal.
- Expected:
  - Latest signal metadata `sampleSize` uses finite history count, not raw document count.
  - Signal mode is cold-start behavior when finite count is below 3.
  - Confidence is cold-start/low-sample bounded.
  - Proposal copies `signalMode`, `uncertaintyEntropy`, `scoreComponents`, and remains consistent with signal.
- Result: To be executed in integration environment.

## Test Case 15: API action normalization remains stable after full proposal generation

- Mục tiêu: Validate presentation API does not alter recommendation from title.
- Setup:
  - Seed or generate proposal:
    - `suggestionType = HOLD`
    - `title = "Short term risk remains elevated for SOL"`
    - `executionStatus = PENDING`
- Steps:
  1. Call `GET /api/proposals`.
  2. Locate proposal.
- Expected:
  - API returns `action = HOLD`.
  - Title keyword `"Short"` does not force `SELL`.
  - Missing/invalid action in another seeded proposal returns `UNKNOWN`, not `BUY`.
- Result: To be executed in integration environment.

## Acceptance Criteria

- End-to-end tests prove at least one valid source document becomes a quant signal, a Layer3 proposal, and API-visible enriched data.
- No test calls internal helper functions directly.
- Failure tests prove external failures do not silently corrupt DB state.
- Signal/proposal consistency tests prove processed signals are immutable with respect to proposal source data.
- Concurrency tests prove only one master pipeline writes for a given scheduled run while active heartbeat prevents stale takeover.
- All created data is isolated to the integration test DB and cleaned after the suite.

## Bugs/Risks to Watch During Execution

- The current local `npm` command may resolve to Windows npm from WSL, causing Turbo commands to fail under UNC paths. Integration runner should use native WSL Node/npm or direct `node ./node_modules/...` commands.
- Master cron currently schedules itself on import; a test-only immediate trigger or controlled fake timer may be needed to make pipeline execution deterministic.
- External API mocks must sit at network/process boundaries. Mocking internal quant or Layer3 functions would invalidate this as an integration suite.
