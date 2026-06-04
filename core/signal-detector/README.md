# @gr2/signal-detector

`core/signal-detector` is the Layer 2 quant engine. It turns tweet/news evidence into token-level alpha signals.

## Responsibilities

- Match tweets and news articles to known tokens.
- Score text sentiment with FinBERT.
- Apply source, author, entropy, and time-decay weighting.
- Aggregate evidence by token.
- Compute self-history z-scores, BTC-neutralized alpha, cross-sectional z-score, and final signal score.
- Persist qualified signals into MongoDB.

## Structure

```text
core/signal-detector
├── scripts/
│   ├── run-quant.ts
│   ├── test-finbert.ts
│   └── test-quant-logic.ts
├── src/
│   ├── quant-engine.ts
│   ├── document-processor.ts
│   ├── token-aggregator.ts
│   ├── alpha-analyzer.ts
│   ├── quant-math.ts
│   ├── finbert.ts
│   ├── db-mapper.ts
│   ├── schema.ts
│   └── types.ts
└── tests/
```

## Commands

```bash
# Run quant signal detection
npm --workspace @gr2/signal-detector run quant

# Root shortcut
npm run signal

# Run tests
npm --workspace @gr2/signal-detector run test

# Build
npm --workspace @gr2/signal-detector run build
```

## Environment

```env
MONGODB_URI=mongodb://localhost:27017/gr2
HUGGINGFACE_API_KEY=...
```

Research jobs may also read `core/research/.env` when invoked through root scripts.

## Signal Flow

1. Compile token matching rules.
2. Match tweets by content and news by `detectedTokens`.
3. Score unique texts with FinBERT.
4. Compute `directionScore = pPositive - pNegative`.
5. Apply entropy, source, author, and time-decay weights.
6. Aggregate weighted documents per token.
7. Compare with token history and BTC market factor.
8. Cross-section normalize eligible tokens.
9. Emit BUY/SELL/HOLD-style signals when thresholds are met.

## Notes

- Cold-start signals are capped by cold-start thresholds and tagged with `signalMode`.
- `uncertaintyEntropy` is the explicit uncertainty field; `volatilityFlag` is compatibility-oriented.
- Keep math helpers covered by tests when changing scoring logic.
