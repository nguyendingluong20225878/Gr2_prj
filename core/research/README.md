# Core Research

`core/research` contains evaluation and feedback jobs for the GR2 signal/proposal pipeline.

## Responsibilities

- Backtest generated proposals against token price history.
- Compute realized outcomes, PnL, drawdown, and evaluation rows.
- Generate rolling metrics.
- Detect market regime.
- Update dynamic weights and maintenance data.
- Support hyperparameter optimization and walk-forward testing.

## Structure

```text
core/research
├── backtest/
│   ├── run-backtest.ts
│   ├── engine.ts
│   ├── backtest.ts
│   ├── pnl-evaluator.ts
│   ├── replay-engine.ts
│   ├── hyperparameter-grid.ts
│   ├── optimize-hyperparams.ts
│   └── walk-forward.ts
├── jobs/
│   ├── run-backtest.ts
│   ├── run-dynamic-weight.ts
│   ├── run-maintenance.ts
│   ├── run-regime.ts
│   └── run-rolling-metrics.ts
└── services/
    ├── dynamic-weight-service.ts
    ├── job-lock.ts
    ├── regime-service.ts
    └── rolling-metrics-service.ts
```

## Commands

From the repository root:

```bash
npm run backtest
npm run backtest:outcome
npm run metrics
npm run regime
npm run weights
npm run maintenance
npm run quant
```

Most root research commands load:

```text
core/research/.env
```

## Environment

```env
MONGODB_URI=mongodb://localhost:27017/gr2
```

Backtests require `token_price_history` to be populated by `core/token-price-fetcher`.

## Notes

- Missing price history can cause proposals to be skipped or evaluated with fallback behavior, depending on the runner options.
- Backtest output feeds proposal outcome fields and `backtest_results`.
- Dynamic weights should be treated as feedback configuration, not immutable truth.
