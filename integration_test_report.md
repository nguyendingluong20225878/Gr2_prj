## Summary
- Total test: 15
- Passed: 12
- Failed: 3
- New bugs: 4

Note: This is a simulated QA execution based on code inspection, not a live run against MongoDB/Next.js. Where runtime-only behavior depends on mocks, timing, or real service availability, the report states `uncertain`.

---

## Test Case 1
- Flow: Seed tokens/accounts/tweet/news -> run `core/signal-detector/scripts/run-quant.ts` -> run `core/layer3/scripts/run-layer3.ts --limit=10` -> call `/api/signals?limit=20` and `/api/proposals`.
- Expected: Quant writes a `RAW` signal; Layer3 creates a proposal and marks signal `PROCESSED`; `/api/signals` exposes `enrichedProposal`; `/api/proposals` returns action from stored action/suggestionType.
- Actual: Quant reads recent `tweets`, `news_articles`, `tokens`, and `x_accounts`, then writes to `signals`. Upsert inserts `status: "RAW"` only on insert (`core/signal-detector/scripts/run-quant.ts:112-149`). Layer3 reads only `status: "RAW"`, upserts proposal, then updates signal to `PROCESSED` (`core/layer3/src/workflow.ts:166-179`). `/api/signals` joins proposals by `signalId` and returns `enrichedProposal` (`apps/web/app/api/signals/route.ts:42-95`). `/api/proposals` normalizes from `p.action ?? p.suggestionType`, not title (`apps/web/app/api/proposals/route.ts:60-80`).
- Result: PASS
- Reason: The core signal -> proposal -> API path is implemented. `uncertain`: ETH news only works if seeded article includes `detectedTokens`; quant does not scan news body directly and relies on `detectedTokens` (`core/signal-detector/src/document-processor.ts:141-147`). The SOL tweet with `$SOL` is enough if score crosses configured threshold.

---

## Test Case 2
- Flow: Seed token `IN` and noise article `"Bitcoin ETF inflows rose in May"` -> process news/insert article as scraper would -> run quant -> query `signals` and APIs for `IN`.
- Expected: No `IN` signal/proposal is generated from lowercase `"in"`.
- Actual: News scraper token matcher requires `$IN`, `$in`, uppercase `IN`, or valid token name, with word boundaries and no case-insensitive flag (`core/news-scraper/src/process.ts:21-47`). Quant then uses only `doc.detectedTokens` for news (`core/signal-detector/src/document-processor.ts:141-147`).
- Result: PASS
- Reason: Lowercase `"in"` is not detected as ticker `IN`, so no `IN` scored document enters quant.

---

## Test Case 3
- Flow: Seed processed SOL signal and matching proposal -> seed newer SOL source -> run quant -> inspect SOL signals/proposal -> run Layer3.
- Expected: Old processed signal/proposal remain immutable; new `RAW` signal is inserted and later gets a separate proposal.
- Actual: Quant upsert filter excludes `status: "PROCESSED"` (`core/signal-detector/scripts/run-quant.ts:114-118`). Therefore the processed signal does not match and a new same-day record is inserted with `status: "RAW"` (`core/signal-detector/scripts/run-quant.ts:142-145`). Layer3 processes only `RAW` signals (`core/layer3/src/workflow.ts:166-169`).
- Result: PASS
- Reason: The processed signal is protected from overwrite by the upsert filter, so the existing proposal remains consistent with its original signal.

---

## Test Case 4
- Flow: Seed processed signal + matching proposal with Layer2/Layer3 metadata -> call `/api/signals?limit=20` -> compare `enrichedProposal` with proposal document.
- Expected: Enriched fields match proposal; `layerConflict` reflects action difference; missing proposal does not crash.
- Actual: API builds `proposalBySignalId`, returns normalized signal without enrichment when missing, and copies proposal fields including `quantScore`, `scoreComponents`, `volatilityFlag`, `uncertaintyEntropy`, `realizedVolatility`, and `tokenSymbol` (`apps/web/app/api/signals/route.ts:42-95`).
- Result: PASS
- Reason: Missing proposals are explicitly tolerated (`if (!proposal) return normalizedSignal`), and enrichment fields are read from the stored proposal.

---

## Test Case 5
- Flow: Unset X credentials, keep `RUN_X_SCRAPER` unset/false, seed DB, then trigger master pipeline.
- Expected: X scraper skipped/warned; quant and Layer3 still run; lock released.
- Actual: Master computes `shouldRunXScraper` from credentials/RUN_X_SCRAPER and logs skip when false (`core/run/src/index.ts:133-160`). Quant and Layer3 `execSync` calls are outside that branch (`core/run/src/index.ts:163-186`). Lock release and `isRunning = false` are in `finally` (`core/run/src/index.ts:190-193`).
- Result: PASS
- Reason: Missing X credentials do not block downstream stages. `uncertain`: the script schedules cron on import and has no built-in immediate trigger (`core/run/src/index.ts:109-205`), so integration runner still needs controlled trigger/wait.

---

## Test Case 6
- Flow: Set `RUN_X_SCRAPER=true`, fake X credentials, force X scraper child process to exit non-zero, then observe master pipeline.
- Expected: Scraper failure logged; quant/Layer3 continue; master process does not fatal solely due scraper.
- Actual: X scraper `execSync` is wrapped in its own try/catch; catch logs failure and continues (`core/run/src/index.ts:142-158`). Quant and Layer3 execute afterward (`core/run/src/index.ts:163-186`).
- Result: PASS
- Reason: Stage 1 failure isolation is implemented at the process boundary.

---

## Test Case 7
- Flow: Seed valid sources/tokens, mock FinBERT timeout/500, run quant, then run Layer3.
- Expected: No malformed/non-finite signals; no proposal from invalid signal; errors logged.
- Actual: FinBERT retries selected transient statuses and on final failure returns finite neutral probabilities `{0.33,0.33,0.34}` (`core/signal-detector/src/finbert.ts:60-84`). Neutral scores produce direction score 0, so normal thresholding should create no signal (`core/signal-detector/src/alpha-analyzer.ts:88-114`).
- Result: PASS
- Reason: Failure fallback is finite and should not create NaN or malformed quant output.

---

## Test Case 8
- Flow: Seed one valid `RAW` signal, make Gemini return 500/timeout, run Layer3, then restore Gemini and rerun Layer3.
- Expected: First run does not create incomplete proposal; signal remains retryable (`RAW` or explicit retryable failure); second run creates proposal.
- Actual: Gemini failure throws from `reasoningNode` (`core/layer3/src/agent.ts:53-56`). `runLayer3Batch` catches it and sets signal `status: "FAILED"` (`core/layer3/src/workflow.ts:173-180`). Later runs query only `{ status: "RAW" }` (`core/layer3/src/workflow.ts:166-169`), so the failed signal is skipped forever unless manually reset.
- Result: FAIL
- Reason: `core/layer3/src/workflow.ts`, function `runLayer3Batch`: external LLM failure makes the signal non-retryable.

---

## Test Case 9
- Flow: Force `insertMany` non-duplicate failure in X tweet persistence -> inspect account checkpoint -> restore DB -> rerun.
- Expected: Non-duplicate DB failure does not advance checkpoint; duplicate-only errors may advance; downstream quant sees only persisted tweets.
- Actual: `saveTweets` sets `persistenceOk` only after successful insert or duplicate-only error (`core/x-scaper/src/db.ts:79-100`). Checkpoint update happens only after persistence is OK (`core/x-scaper/src/db.ts:102-119`). On non-duplicate error it returns `null` (`core/x-scaper/src/db.ts:123-127`).
- Result: PASS
- Reason: Checkpoint advancement is gated behind persistence success/duplicate-only tolerance.

---

## Test Case 10
- Flow: Start master pipeline, force DB outage during quant/Layer3 or lock release, restore DB, trigger again.
- Expected: First run logs failure and reaches `finally`; `isRunning` and DB lock are released; second run proceeds.
- Actual: Pipeline errors from child stages are caught (`core/run/src/index.ts:188-189`), but `finally` awaits `releasePipelineLock(lockOwner)` before setting `isRunning = false` (`core/run/src/index.ts:190-193`). If DB outage makes `releasePipelineLock` throw, `isRunning = false` is not reached. `releasePipelineLock` itself does not catch update failure (`core/run/src/index.ts:79-85`).
- Result: FAIL
- Reason: `core/run/src/index.ts`, functions `releasePipelineLock` and cron callback `finally`: release failure can leave in-process state stuck.

---

## Test Case 11
- Flow: Start two master processes against same MongoDB with slow first run -> inspect lock and writes.
- Expected: Only one runner owns lock; second skips; no duplicate writes caused by concurrent master runs.
- Actual: Lock acquisition uses atomic `findOneAndUpdate` for stale/released locks, then duplicate-key-safe `insertOne` fallback (`core/run/src/index.ts:35-76`). The second process should fail insert or fail match once first owner holds unreleased lock.
- Result: PASS
- Reason: Distributed lock acquisition is atomic enough for simultaneous startup under MongoDB semantics.

---

## Test Case 12
- Flow: Long run beyond original TTL while heartbeat active, then start process B.
- Expected: A refreshes `lockedAt`; B does not acquire while A is active; A releases after finish.
- Actual: Heartbeat calls `refreshPipelineLock` every `max(30_000, LOCK_TTL_MS / 3)` (`core/run/src/index.ts:126-130`), updating `lockedAt` and `ttlMs` while unreleased (`core/run/src/index.ts:88-99`).
- Result: PASS
- Reason: With current `LOCK_TTL_MS = 10 minutes`, heartbeat interval is about 3.3 minutes, below TTL. `uncertain`: if tests reduce TTL below 30 seconds, the hardcoded `max(30_000, ...)` can become longer than TTL.

---

## Test Case 13
- Flow: Insert stale `job_locks` document older than TTL -> trigger master pipeline.
- Expected: New owner acquires stale lock, runs, then releases.
- Actual: `acquirePipelineLock` matches `lockedAt <= staleBefore` and sets new owner/releasedAt null (`core/run/src/index.ts:39-60`). Release sets `releasedAt` after completion (`core/run/src/index.ts:79-85`).
- Result: PASS
- Reason: Stale lock recovery path exists and owner is replaced atomically.

---

## Test Case 14
- Flow: Seed 7-day SOL history with only two finite `metadata.scoreComponents.unifiedRaw` values and several invalid values -> run quant -> run Layer3 -> inspect proposal.
- Expected: Sample size uses finite count; cold-start behavior applies; proposal copies signal metadata.
- Actual: History loader filters non-finite values before storing in `historicalData` (`core/signal-detector/scripts/run-quant.ts:78-91`). Alpha uses finite history count for cold-start mode and confidence cap (`core/signal-detector/src/alpha-analyzer.ts:17-27`, `core/signal-detector/src/alpha-analyzer.ts:91-139`). Proposal copies `signalMode`, `uncertaintyEntropy`, and `scoreComponents` from signal (`core/layer3/src/workflow.ts:139-145`).
- Result: PASS
- Reason: Finite-only history count is preserved through quant and copied into Layer3 proposal.

---

## Test Case 15
- Flow: Seed proposal with `suggestionType = HOLD`, title containing `"Short"` -> call `/api/proposals`; seed another with missing/invalid action.
- Expected: API returns `HOLD`; title keyword does not force `SELL`; missing/invalid action returns `UNKNOWN`, not `BUY`.
- Actual: API extracts token symbol from title only, not action (`apps/web/app/api/proposals/route.ts:60-65`). `normalizeAction` accepts only BUY/SELL/HOLD and otherwise returns `UNKNOWN` (`apps/web/app/api/proposals/route.ts:38-41`).
- Result: PASS
- Reason: Action normalization no longer infers SELL from title text.

---

## New Bugs Found (QUAN TRỌNG NHẤT)

### Bug 1
- Mô tả: Layer3 failure makes signal non-retryable.
- Khi xảy ra: Gemini/API key/network fails while processing a valid `RAW` signal.
- Root cause: `runLayer3Batch` catches any error and writes `status: "FAILED"` (`core/layer3/src/workflow.ts:173-180`), but later batches only select `status: "RAW"` (`core/layer3/src/workflow.ts:166-169`).
- Impact: Temporary LLM outage permanently blocks proposal generation for that signal unless manual DB repair is done.

---

### Bug 2
- Mô tả: New quant output can be written into a `FAILED` signal but remains invisible to Layer3.
- Khi xảy ra: A signal failed in Layer3, then a later quant run for the same token on the same day produces updated score/source data.
- Root cause: Quant upsert filter matches any same-day signal with `status != "PROCESSED"` (`core/signal-detector/scripts/run-quant.ts:114-118`). The `$set` updates score/sources but does not set `status: "RAW"`; status is only in `$setOnInsert` (`core/signal-detector/scripts/run-quant.ts:120-146`).
- Impact: Fresh data can overwrite the failed signal while keeping `status = FAILED`, so Layer3 never processes the new data. This is a signal/proposal consistency and data-loss risk.

---

### Bug 3
- Mô tả: Master cron can remain stuck in memory after DB failure during lock release.
- Khi xảy ra: DB becomes unavailable while `finally` calls `releasePipelineLock`.
- Root cause: `await releasePipelineLock(lockOwner)` happens before `isRunning = false` and is not protected by its own try/catch (`core/run/src/index.ts:190-193`). `releasePipelineLock` does not swallow update errors (`core/run/src/index.ts:79-85`).
- Impact: The process can keep `isRunning = true`, causing all later cron ticks in that process to skip even after DB recovers.

---

### Bug 4
- Mô tả: `/api/proposals` fabricates user-facing semantics for missing fields.
- Khi xảy ra: Proposal lacks `confidence` or `financialImpact`.
- Root cause: API defaults missing confidence to `85` and derives `sentimentType` from ROI, which defaults to `0`, making missing ROI positive (`apps/web/app/api/proposals/route.ts:67-95`).
- Impact: API can display high confidence and positive sentiment for incomplete Layer3 proposals, masking missing data.

---

## System Consistency Check

### Signal -> Proposal
- Inconsistent
- Giải thích: Normal happy path is consistent because Layer3 copies quant fields from signal into proposal (`core/layer3/src/workflow.ts:129-159`) and `/api/signals` enriches by `signalId` (`apps/web/app/api/signals/route.ts:42-95`). However, failed Layer3 signals become non-retryable, and later quant runs can overwrite `FAILED` signal fields without creating a proposal or resetting to `RAW`.

### Pipeline Stability
- Có crash không: Yes, possible.
- Khi nào crash: Quant/Layer3 child process failures are caught by master, but DB failure during `releasePipelineLock` can escape `finally` before `isRunning` is reset. Layer3 external API failure does not crash the batch process, but it corrupts retry state by marking signal `FAILED`.

---

## Final Verdict

- NOT READY
- Lý do: The happy path mostly works, but production failure handling is not safe enough. A temporary Gemini outage can permanently strand signals, and a DB outage during lock release can leave the master cron stuck. These are production-grade reliability issues, not cosmetic mismatches.
