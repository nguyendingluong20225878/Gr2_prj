export {
  calculateTradePnl,
  classifyTrade,
  evaluateVirtualProposals,
  nearestPrice,
  resolveTradeDirection,
} from "./pnl-evaluator.js";

export type {
  EvaluatedTrade,
  EvaluatorPricePoint as PricePoint,
  PnlEvaluationResult,
  PnlEvaluatorOptions,
  TradeDirection,
  TradeWinLossStatus,
  VirtualProposal,
} from "./pnl-evaluator.js";

export { runProposalBacktest } from "./engine.js";

export type {
  BacktestEngineOptions,
  BacktestSummary,
} from "./engine.js";
