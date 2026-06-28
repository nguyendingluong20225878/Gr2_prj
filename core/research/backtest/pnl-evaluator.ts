import {
  calculateDirectionalTradePnl,
  classifyTrade,
  resolveTradeDirection,
  type TradeDirection,
  type TradeWinLossStatus,
} from "./trade-math.js";

export type { TradeDirection, TradeWinLossStatus };
export { classifyTrade, resolveTradeDirection };

export type EvaluatorPricePoint = {
  timestamp: Date;
  priceUsd: number;
};

export type VirtualProposal = {
  id: string;
  tokenSymbol: string;
  tokenAddress: string;
  suggestionType: string;
  detectedAt: Date;
  expiresAt?: Date;
};

export type EvaluatedTrade = {
  proposalId: string;
  tokenSymbol: string;
  suggestionType: string;
  detectedAt: Date;
  expiresAt: Date;
  entryPrice: number;
  exitPrice: number;
  grossPnlPercentage: number;
  pnlPercentage: number;
  actualPnL: number;
  winLossStatus: TradeWinLossStatus;
  equityAfterTrade: number;
};

export type PnlEvaluatorOptions = {
  horizonHours: number;
  feeRate: number;
  slippageRate: number;
  notionalUsd: number;
  sparseMaxDistanceMs: number;
  maxAbsGrossMove?: number;
  tokenKeysBySymbol?: Map<string, string[]>;
  tokenKeysByAddress?: Map<string, string[]>;
};

export type PnlEvaluationResult = {
  scanned: number;
  evaluated: number;
  skipped: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalPnL: number;
  totalPnlPercentage: number;
  endingPnl: number;
  endingEquity: number;
  maxDrawdownUsd: number;
  trades: EvaluatedTrade[];
};

export function nearestPrice(points: EvaluatorPricePoint[], at: Date) {
  let best: EvaluatorPricePoint | null = null;
  let bestDistanceMs = Number.POSITIVE_INFINITY;

  for (const point of points) {
    const distanceMs = Math.abs(point.timestamp.getTime() - at.getTime());
    if (distanceMs < bestDistanceMs) {
      best = point;
      bestDistanceMs = distanceMs;
    }
  }

  return best ? { ...best, distanceMs: bestDistanceMs } : null;
}

export function calculateTradePnl(params: {
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  feeRate: number;
  slippageRate: number;
  notionalUsd: number;
}) {
  return calculateDirectionalTradePnl(params);
}

function candidateTokenKeys(
  proposal: VirtualProposal,
  options: PnlEvaluatorOptions
): string[] {
  const keys = new Set<string>();
  if (proposal.tokenAddress) keys.add(proposal.tokenAddress);
  if (proposal.tokenAddress.startsWith("coingecko:")) {
    keys.add(proposal.tokenAddress.replace("coingecko:", ""));
  }

  for (const key of options.tokenKeysBySymbol?.get(proposal.tokenSymbol) ?? []) {
    keys.add(key);
  }
  for (const key of options.tokenKeysByAddress?.get(proposal.tokenAddress) ?? []) {
    keys.add(key);
  }

  return [...keys];
}

function findBestPricePair(
  proposal: VirtualProposal,
  expiresAt: Date,
  priceByTokenKey: Map<string, EvaluatorPricePoint[]>,
  options: PnlEvaluatorOptions
) {
  let best: {
    entry: EvaluatorPricePoint & { distanceMs: number };
    exit: EvaluatorPricePoint & { distanceMs: number };
    distanceMs: number;
  } | null = null;

  for (const key of candidateTokenKeys(proposal, options)) {
    const points = (priceByTokenKey.get(key) ?? [])
      .slice()
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    if (points.length === 0) continue;

    const entry = nearestPrice(points, proposal.detectedAt);
    const exit = nearestPrice(points, expiresAt);
    if (
      !entry ||
      !exit ||
      entry.distanceMs > options.sparseMaxDistanceMs ||
      exit.distanceMs > options.sparseMaxDistanceMs
    ) {
      continue;
    }

    const distanceMs = entry.distanceMs + exit.distanceMs;
    if (!best || distanceMs < best.distanceMs) {
      best = { entry, exit, distanceMs };
    }
  }

  return best;
}

export function evaluateVirtualProposals(
  proposals: VirtualProposal[],
  priceByTokenKey: Map<string, EvaluatorPricePoint[]>,
  options: PnlEvaluatorOptions
): PnlEvaluationResult {
  let equity = 0;
  let peakEquity = 0;
  const result: PnlEvaluationResult = {
    scanned: proposals.length,
    evaluated: 0,
    skipped: 0,
    wins: 0,
    losses: 0,
    breakeven: 0,
    winRate: 0,
    totalPnL: 0,
    totalPnlPercentage: 0,
    endingPnl: 0,
    endingEquity: 0,
    maxDrawdownUsd: 0,
    trades: [],
  };

  for (const proposal of proposals) {
    const direction = resolveTradeDirection(proposal.suggestionType);
    const expiresAt =
      proposal.expiresAt ??
      new Date(proposal.detectedAt.getTime() + options.horizonHours * 60 * 60 * 1000);
    if (!direction) {
      result.skipped += 1;
      continue;
    }

    const pricePair = findBestPricePair(proposal, expiresAt, priceByTokenKey, options);
    if (!pricePair) {
      result.skipped += 1;
      continue;
    }

    const { entry, exit } = pricePair;
    const grossMove = (exit.priceUsd - entry.priceUsd) / entry.priceUsd;
    const maxAbsGrossMove = options.maxAbsGrossMove ?? 0.75;
    if (Math.abs(grossMove) > maxAbsGrossMove) {
      result.skipped += 1;
      continue;
    }

    const pnl = calculateTradePnl({
      direction,
      entryPrice: entry.priceUsd,
      exitPrice: exit.priceUsd,
      feeRate: options.feeRate,
      slippageRate: options.slippageRate,
      notionalUsd: options.notionalUsd,
    });

    equity += pnl.actualPnL;
    peakEquity = Math.max(peakEquity, equity);
    result.maxDrawdownUsd = Math.max(result.maxDrawdownUsd, peakEquity - equity);
    result.evaluated += 1;
    result.totalPnL += pnl.actualPnL;
    result.totalPnlPercentage += pnl.pnlPercentage;
    result.endingPnl = equity;
    result.endingEquity = equity;
    if (pnl.winLossStatus === "WIN") result.wins += 1;
    if (pnl.winLossStatus === "LOSS") result.losses += 1;
    if (pnl.winLossStatus === "BREAKEVEN") result.breakeven += 1;
    result.trades.push({
      proposalId: proposal.id,
      tokenSymbol: proposal.tokenSymbol,
      suggestionType: proposal.suggestionType,
      detectedAt: proposal.detectedAt,
      expiresAt,
      entryPrice: entry.priceUsd,
      exitPrice: exit.priceUsd,
      ...pnl,
      equityAfterTrade: equity,
    });
  }

  result.winRate = result.evaluated > 0 ? result.wins / result.evaluated : 0;
  return result;
}
