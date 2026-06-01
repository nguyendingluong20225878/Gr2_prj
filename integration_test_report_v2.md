## Summary
- Total test: 15
- Passed: 14
- Failed: 1
- New bugs: 1

Note: This is a simulated QA execution on UPDATED_CODE v3 + `implementation_v3.md`, based on code inspection. No live MongoDB/Next HTTP integration runner was executed in this turn. Runtime-only items are marked `uncertain` where needed.

---

## Regression Comparison vs `integration_test_report.md`
- Old FAIL -> now PASS: Test Case 8
- Old FAIL -> still FAIL: Test Case 10
- Old PASS -> now FAIL: None found
- Old PASS -> still PASS: Test Case 1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15

---

## Test Case 1
- Flow: Seed baseline tokens/accounts/tweet/news -> run quant -> run Layer3 -> start Next app -> call `/api/signals?limit=20` and `/api/proposals`.
- Expected: Quant creates `RAW` signal; Layer3 creates proposal and marks signal `PROCESSED`; APIs expose enriched signal and proposal action from stored data.
- Actual: Quant still loads recent `news_articles`, `tweets`, `tokens`, `x_accounts` and writes to `signals`. Upsert inserts `status: "RAW"` on insert (`core/signal-detector/scripts/run-quant.ts:145-149`). Layer3 reads retryable `RAW` signals, creates proposal, then marks signal `PROCESSED` (`core/layer3/src/workflow.ts:176-185`, `core/layer3/src/workflow.ts:132-162`). `/api/proposals` still normalizes action from `p.action ?? p.suggestionType` (`apps/web/app/api/proposals/route.ts:65`).
- Result: PASS
- Reason: Happy path remains intact after v3. `uncertain`: ETH news still depends on `detectedTokens`; implementation_v3 explicitly did not change production quant fallback for news fixtures.

---

## Test Case 2
- Flow: Seed token `IN` and noise article with lowercase `"in"` -> run news/quant -> query signals/proposals.
- Expected: No `IN` signal/proposal from lowercase text.
- Actual: No relevant v3 change. News token matcher still requires `$IN`, `$in`, uppercase `IN`, or valid token name; quant still consumes `detectedTokens` for news.
- Result: PASS
- Reason: Existing false-positive protection is preserved.

---

## Test Case 3
- Flow: Existing same-day `PROCESSED` SOL signal + proposal -> newer SOL source -> run quant -> run Layer3.
- Expected: Old processed signal is immutable; new `RAW` signal/proposal pair is created.
- Actual: v3 quant filter matches only same-day `RAW` or legacy missing-status signal (`core/signal-detector/scripts/run-quant.ts:114-121`). A same-day `PROCESSED` signal is not matched, so upsert inserts a new `RAW` signal.
- Result: PASS
- Reason: v3 keeps the old protection and narrows the mutation surface further.

---

## Test Case 4
- Flow: Seed processed signal + matching proposal with metadata -> call `/api/signals?limit=20`.
- Expected: `enrichedProposal` fields match proposal; missing proposal does not crash.
- Actual: No v3 regression found in `/api/signals`; enrichment still joins by `signalId` and returns signal without enrichment if proposal is missing.
- Result: PASS
- Reason: Signal/proposal API consistency behavior is unchanged.

---

## Test Case 5
- Flow: Missing X credentials, `RUN_X_SCRAPER` unset/false -> trigger master pipeline.
- Expected: X skip warning; quant and Layer3 run; lock cleanup after completion.
- Actual: Master still skips X when disabled/missing credentials and runs quant/Layer3 afterward (`core/run/src/index.ts:133-188`). v3 wraps lock release and always resets `isRunning` in nested `finally` (`core/run/src/index.ts:191-199`).
- Result: PASS
- Reason: No regression; v3 improves in-memory cleanup.

---

## Test Case 6
- Flow: `RUN_X_SCRAPER=true`, fake credentials, force X scraper child process failure -> observe master.
- Expected: Stage 1 error logged; quant/Layer3 continue; master does not fatal solely due X.
- Actual: X scraper is still isolated in its own try/catch (`core/run/src/index.ts:143-159`); downstream stages remain outside that catch (`core/run/src/index.ts:164-188`).
- Result: PASS
- Reason: Stage failure isolation remains intact.

---

## Test Case 7
- Flow: Mock FinBERT timeout/500 -> run quant -> run Layer3.
- Expected: No NaN/malformed signal; no proposal from invalid signal.
- Actual: No v3 change in FinBERT failure fallback. It still returns finite neutral scores after retries, which should not cross signal threshold.
- Result: PASS
- Reason: Finite fallback behavior remains safe.

---

## Test Case 8
- Flow: Seed valid `RAW` signal -> Gemini fails first run -> inspect signal/proposals -> restore Gemini -> rerun Layer3.
- Expected: First run creates no incomplete proposal; signal remains retryable; second run creates proposal; signal becomes `PROCESSED` only after proposal write succeeds.
- Actual: v3 catches runtime error, increments `layer3RetryCount`, stores `lastLayer3Error`, and keeps `status: "RAW"` until retry cap is reached (`core/layer3/src/workflow.ts:189-212`). Next successful run still selects this signal because query allows missing/under-cap retry count (`core/layer3/src/workflow.ts:176-185`), writes proposal before marking signal `PROCESSED` (`core/layer3/src/workflow.ts:132-162`).
- Result: PASS
- Reason: Old FAIL is fixed for normal default retry path. Validation errors still become `FAILED`, which is correct because they are not external/transient failures (`core/layer3/src/workflow.ts:115-123`).

---

## Test Case 9
- Flow: Force non-duplicate `insertMany` failure in X tweet persistence -> inspect checkpoint -> restore DB -> rerun.
- Expected: Non-duplicate failure does not advance checkpoint; duplicate-only can advance.
- Actual: No v3 change. Checkpoint update remains after persistence success/duplicate-only path.
- Result: PASS
- Reason: Data-loss prevention remains intact.

---

## Test Case 10
- Flow: Start master pipeline -> force DB error during quant or Layer3 stage -> wait for failure handling -> restore DB -> trigger again.
- Expected: First run reaches `finally`; `isRunning` does not stay stuck; `job_locks` is released if owner was acquired; second run can acquire lock and proceed.
- Actual: v3 fixes the in-memory part: `releasePipelineLock` is wrapped and `isRunning = false` always executes (`core/run/src/index.ts:191-199`). But if DB is still unavailable during `releasePipelineLock`, the catch only logs the failure; it does not retry release after DB recovers (`core/run/src/index.ts:193-197`). The `job_locks` row can remain unreleased until TTL/stale recovery, so an immediate second trigger after DB restore can still skip because lock is not released (`core/run/src/index.ts:35-76`).
- Result: FAIL
- Reason: Old crash/stuck-process part is fixed, but the full expected behavior is not satisfied. File: `core/run/src/index.ts`, functions `releasePipelineLock` and cron `finally`. Root cause: failed lock release is swallowed without deferred retry or immediate stale override, leaving DB lock active until TTL.

---

## Test Case 11
- Flow: Start two master processes concurrently -> inspect lock and writes.
- Expected: Only one active runner; second skips; no duplicate writes.
- Actual: Lock acquisition remains atomic through `findOneAndUpdate` plus duplicate-key-safe insert fallback (`core/run/src/index.ts:35-76`).
- Result: PASS
- Reason: No PASS -> FAIL regression found.

---

## Test Case 12
- Flow: Long-running pipeline beyond original TTL -> heartbeat active -> process B starts.
- Expected: A refreshes lock; B cannot acquire while heartbeat active.
- Actual: v3 changes heartbeat interval from `max(30_000, TTL/3)` to `max(1_000, TTL/3)` (`core/run/src/index.ts:125-131`).
- Result: PASS
- Reason: Current 10-minute TTL still refreshes around every 3.3 minutes; reduced test TTLs are now safer than v2. No regression.

---

## Test Case 13
- Flow: Insert stale lock older than TTL -> trigger master.
- Expected: New process acquires stale lock and releases after completion.
- Actual: Stale lock acquisition still matches `lockedAt <= staleBefore` and sets new owner (`core/run/src/index.ts:39-60`).
- Result: PASS
- Reason: Stale recovery behavior remains intact.

---

## Test Case 14
- Flow: Seed SOL history with two finite values and invalid values -> run quant -> run Layer3 -> inspect proposal.
- Expected: Finite count drives cold-start; proposal copies signal metadata.
- Actual: No v3 regression. History loader still filters non-finite values; Layer3 still copies `signalMode`, `uncertaintyEntropy`, and `scoreComponents`.
- Result: PASS
- Reason: Cold-start data consistency remains intact.

---

## Test Case 15
- Flow: Seed proposal `suggestionType = HOLD` with title containing `"Short"` -> call `/api/proposals`.
- Expected: `action = HOLD`; title does not force SELL; invalid action returns UNKNOWN.
- Actual: v3 keeps `normalizeAction(p.action ?? p.suggestionType)` and does not infer action from title (`apps/web/app/api/proposals/route.ts:38-41`, `apps/web/app/api/proposals/route.ts:61-65`).
- Result: PASS
- Reason: No action-normalization regression.

---

## Old FAIL Status

### Test Case 8
- Previous: FAIL
- Current: PASS
- Why: Runtime Layer3 errors keep signal `RAW` under retry cap and increment retry metadata (`core/layer3/src/workflow.ts:189-212`).

### Test Case 10
- Previous: FAIL
- Current: FAIL
- Why: `isRunning` cleanup is fixed, but DB lock release can still fail and remain unreleased until TTL if DB outage persists through `finally`.

---

## PASS -> FAIL Regression Check
- No old PASS test became FAIL.
- Side-effect of quant v3 was checked: excluding `FAILED` from same-day upsert does not break Test Case 3 because `PROCESSED` still inserts a new `RAW`; existing `RAW` signals still update normally.
- Side-effect of proposals API v3 was checked: confidence/ROI can now be `null`, but Test Case 15 only requires stable action normalization, so it remains PASS.

---

## New Bugs Found (QUAN TRỌNG NHẤT)

### Bug 1
- Mô tả: RAW signal with `layer3RetryCount >= maxRetry` can be skipped forever without being marked `FAILED`.
- Khi xảy ra: Existing data has `status = "RAW"` and `layer3RetryCount` already at/above current `LAYER3_MAX_RETRY`, for example after lowering env retry cap, manual DB edits, or an interrupted previous implementation.
- Root cause: Batch query excludes over-cap RAW signals (`core/layer3/src/workflow.ts:176-185`), while the code only marks `FAILED` inside catch after selecting and processing a signal (`core/layer3/src/workflow.ts:189-207`).
- Impact: These signals are neither processed nor transitioned to terminal failure, so monitoring may show stale RAW data and Layer3 never retries them.

---

## System Consistency Check

### Signal -> Proposal
- Mostly consistent
- Giải thích: Happy path and transient Layer3 failure recovery are now consistent: proposal write happens before signal becomes `PROCESSED`, and retryable external failures keep the signal `RAW`. Remaining inconsistency risk is over-cap `RAW` retry records being skipped forever.

### Pipeline Stability
- Có crash không: Less likely than v2, but still not fully stable.
- Khi nào crash/skip: Child process failures are contained. Release-lock failure no longer keeps `isRunning = true`, but if DB lock cannot be released during outage, the next run can still skip until TTL/stale recovery.

---

## Final Verdict

- NOT READY
- Lý do: v3 fixes the biggest Layer3 retry bug and removes PASS->FAIL regressions. However, Test Case 10 still does not fully satisfy the production expectation because DB lock release is not guaranteed after outage recovery; the system can skip the immediate next run until lock TTL expires.
