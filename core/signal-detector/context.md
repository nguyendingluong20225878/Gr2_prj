### 1. Mục đích thư mục

`signal-detector` là quant core của hệ thống. Nó biến raw tweet/news thành token-level alpha signals.

### 2. Thành phần bên trong

- `src/quant-engine.ts`: orchestration entrypoint `detectSignalWithFinBertQuant`.
- `src/document-processor.ts`: token matching, FinBERT scoring, decay/weighting.
- `src/token-aggregator.ts`: group scored documents by token and create `unifiedRaw`.
- `src/alpha-analyzer.ts`: time-series z-score, BTC beta neutralization, cross-sectional z-score, final signal.
- `src/quant-math.ts`: entropy, decay, median, MAD, EMA helpers.
- `src/finbert.ts`: HuggingFace FinBERT call/retry/normalization.
- `src/db-mapper.ts`: map quant output to Mongo signal and persist.
- `src/types.ts`: public/internal types and default hyperparameters.
- `src/services/hyperparam-config-service.ts`: active hyperparameter loading/promoting.
- `scripts`: run/test quant scripts.
- `tests`: quant math tests and examples.

### 3. Luồng hoạt động

Input: `formattedTweets`, `formattedNews`, `knownTokens`, optional `historicalData`, optional `hyperParams`. Process: score documents, aggregate by token, compute alpha. Output: `Partial<QuantSignalResponse>[]`, optionally persisted into `signals`.

### 4. Dependency

Depends on `@gr2/shared` for DB persistence/config, HuggingFace API via `fetch`, and TypeScript/Vitest.

### 5. Logic quan trọng

Pipeline:

1. Compile token regex.
2. Match tweets by text, news by `detectedTokens`.
3. Call FinBERT per unique text.
4. Compute `directionScore = pPos - pNeg`.
5. Compute entropy and time decay.
6. Compute source weight.
7. Group by token.
8. Compute `unifiedRaw`.
9. Compare against historical self baseline (`timeZ`).
10. Neutralize BTC market factor (`pureAlphaZ`).
11. Cross-section normalize (`crossZ`).
12. Blend final score and emit signal if above threshold.

### 6. Rủi ro / vấn đề

- `authorWeight` is now used when provided by the runner; `run-quant.ts` derives a bounded follower-count weight from `x_accounts`.
- News source dynamic weight now reads `source_weights.siteWeight` by host and multiplies `newsBaseWeight`.
- Cold-start signals are tagged `signalMode: COLD_START` and capped to `hold` by default via `coldStartActionThreshold`.
- `uncertaintyEntropy` is written explicitly. `volatilityFlag` remains only as a compatibility alias.

### 7. Cách cải thiện

- Feed back source/author weights from backtest IC rather than only reading existing `source_weights`.
- Add true price volatility from `token_price_history` and populate `realizedVolatility`.
- Persist model version and hyperparameter config id in signal metadata.
- Add tests around cold start, BTC missing, validAlphas < 3, source schema persistence.
