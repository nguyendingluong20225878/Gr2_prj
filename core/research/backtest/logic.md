### PnL Formula Breakdown

The shared implementation lives in `trade-math.ts`. `engine.ts` and `pnl-evaluator.ts` should import from it rather than reimplementing formulas.

#### LONG

`effectiveEntry = entryPrice * (1 + slippageRate)`

`effectiveExit = exitPrice * (1 - slippageRate)`

`grossPnlPercentage = (effectiveExit - effectiveEntry) / effectiveEntry`

`pnlPercentage = grossPnlPercentage - 2 * feeRate`

`actualPnL = notionalUsd * pnlPercentage`

Meaning: Buy pays worse entry due to slippage, exits slightly worse, and pays round-trip fees.

#### SHORT

`effectiveEntry = entryPrice * (1 - slippageRate)`

`effectiveExit = exitPrice * (1 + slippageRate)`

`grossPnlPercentage = (effectiveEntry - effectiveExit) / effectiveEntry`

`pnlPercentage = grossPnlPercentage - 2 * feeRate`

`actualPnL = notionalUsd * pnlPercentage`

Meaning: Short wins when exit is lower than entry. Slippage hurts both opening and covering.

#### HOLD / FLAT in `engine.ts`

`grossMove = (exitPrice - entryPrice) / entryPrice`

`missedMove = max(abs(grossMove) - holdMoveThreshold, 0)`

`pnlPercentage = missedMove > 0 ? -missedMove : 0`

Meaning: HOLD is rewarded as WIN if market stayed within threshold; punished if a meaningful move was missed. This is a product choice: it treats missed opportunity as loss.

#### Win/Loss

`BREAKEVEN` if `abs(pnlPercentage) < 0.000001`; else `WIN` if positive, `LOSS` if negative.

#### Equity and Drawdown

`equity += actualPnL`

`peakEquity = max(peakEquity, equity)`

`maxDrawdownUsd = max(maxDrawdownUsd, peakEquity - equity)`

Meaning: drawdown measures worst decline from equity high-water mark.

#### Hyperparameter Objective

`objectiveScore = totalPnL * pnlWeight + winRate * winRateWeight + log1p(evaluated) * tradeCountWeight - maxDrawdownUsd * drawdownWeight`

Defaults:

- `pnlWeight = 1`
- `winRateWeight = 500`
- `tradeCountWeight = 0.25`
- `drawdownWeight = 0.5`

Meaning: rank candidates by profitability, reliability, enough trades, and lower drawdown. The win-rate weight is large, so high win rate can dominate small PnL differences.
