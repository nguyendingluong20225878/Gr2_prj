export type TradeDirection = "LONG" | "SHORT";
export type BacktestDirection = TradeDirection | "FLAT";
export type TradeWinLossStatus = "WIN" | "LOSS" | "BREAKEVEN";

export function resolveBacktestDirection(suggestionType: string): BacktestDirection | null {
  const normalized = suggestionType.toLowerCase();
  if (normalized === "buy" || normalized === "stake") return "LONG";
  if (normalized === "sell" || normalized === "close_position") return "SHORT";
  if (normalized === "hold") return "FLAT";
  return null;
}

export function resolveTradeDirection(suggestionType: string): TradeDirection | null {
  const direction = resolveBacktestDirection(suggestionType);
  return direction === "LONG" || direction === "SHORT" ? direction : null;
}

export function classifyTrade(pnlPercentage: number): TradeWinLossStatus {
  if (Math.abs(pnlPercentage) < 0.000001) return "BREAKEVEN";
  return pnlPercentage > 0 ? "WIN" : "LOSS";
}

export function calculateDirectionalTradePnl(params: {
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  feeRate: number;
  slippageRate: number;
  notionalUsd: number;
}) {
  const roundTripFee = params.feeRate * 2;
  let grossPnlPercentage: number;

  if (params.direction === "LONG") {
    const effectiveEntry = params.entryPrice * (1 + params.slippageRate);
    const effectiveExit = params.exitPrice * (1 - params.slippageRate);
    grossPnlPercentage = (effectiveExit - effectiveEntry) / effectiveEntry;
  } else {
    const effectiveEntry = params.entryPrice * (1 - params.slippageRate);
    const effectiveExit = params.exitPrice * (1 + params.slippageRate);
    grossPnlPercentage = (effectiveEntry - effectiveExit) / effectiveEntry;
  }

  const pnlPercentage = grossPnlPercentage - roundTripFee;
  const actualPnL = params.notionalUsd * pnlPercentage;

  return {
    grossPnlPercentage,
    pnlPercentage,
    actualPnL,
    winLossStatus: classifyTrade(pnlPercentage),
  };
}

export function calculateFlatTradePnl(params: {
  entryPrice: number;
  exitPrice: number;
  holdMoveThreshold: number;
  notionalUsd: number;
}) {
  const grossPnlPercentage = (params.exitPrice - params.entryPrice) / params.entryPrice;
  const missedMove = Math.max(Math.abs(grossPnlPercentage) - params.holdMoveThreshold, 0);
  const pnlPercentage = missedMove > 0 ? -missedMove : 0;
  const actualPnL = params.notionalUsd * pnlPercentage;

  return {
    grossPnlPercentage,
    pnlPercentage,
    actualPnL,
    winLossStatus: missedMove > 0 ? "LOSS" as const : "WIN" as const,
  };
}

export function calculateBacktestTradePnl(params: {
  direction: BacktestDirection;
  entryPrice: number;
  exitPrice: number;
  feeRate: number;
  slippageRate: number;
  notionalUsd: number;
  holdMoveThreshold: number;
}) {
  if (params.direction === "FLAT") {
    return calculateFlatTradePnl(params);
  }

  return calculateDirectionalTradePnl({
    direction: params.direction,
    entryPrice: params.entryPrice,
    exitPrice: params.exitPrice,
    feeRate: params.feeRate,
    slippageRate: params.slippageRate,
    notionalUsd: params.notionalUsd,
  });
}
