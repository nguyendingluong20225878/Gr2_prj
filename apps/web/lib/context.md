### 1. Mục đích thư mục

`lib` là utility/application layer của frontend: hooks gọi API, type/semantic normalization, constants, demo data.

### 2. Thành phần bên trong

- `hooks`: `useSignals`, `useProposals`, `usePortfolio`, `useSignalAnalytics`, `useTokenPrices`.
- `utils`: `signalAnalytics`, `semantics`, `enumMaps`, `navigation`.
- `types`: analytics-specific types.
- `constants/tokens.ts`: token display fallback.
- `demo/mockScenario.ts`: cached demo scenario.
- `api`, `config`: API client and config wrappers.
- `mongodb.ts`: Next API MongoDB connection helper.

### 3. Luồng hoạt động

Hooks fetch API, normalize into state. `useSignalAnalytics` wraps `useSignals` and computes analytics rows/summary with `buildSignalAnalytics`. Pages consume rows rather than raw backend data.

### 4. Dependency

Client hooks depend on browser `fetch`, React state/effect/memo. Server utilities depend on Mongoose.

### 5. Logic quan trọng

`buildSignalAnalytics` sorts by absolute score, derives row action from Layer 3 if available else Layer 2, calculates deltas from optional previous metadata, classifies divergence, builds summary counts. Sau P0, analytics phân biệt `uncertaintyEntropy` với `realizedVolatility`.

Formula:

- `momentumAcceleration = deltaSignal + deltaZScore * 0.35`
- `averageConfidence = round(sum(confidence) / n)`
- `breadth = buyCount / totalSignals` is used by `RegimeStatus` for market regime.

Ý nghĩa: frontend approximates trend/risk from already-produced signals. It does not recompute quant alpha; it packages signal metadata for UX.

### 6. Rủi ro / vấn đề

- `scoreFromSignal` fallback uses confidence as score if quant score missing; this can make UI rank low-quality data as alpha.
- `useSignals`/`useProposals` no longer silently replace backend failures with demo data unless `NEXT_PUBLIC_DEMO_MODE=true`.
- `usePortfolio` is still mock/TODO and not aligned with `positions/page.tsx`.

### 7. Cách cải thiện

- Continue surfacing `dataQuality: REAL | DEMO | EMPTY | ERROR` through UI states.
- Keep score ranking unavailable when quant score missing instead of substituting confidence.
