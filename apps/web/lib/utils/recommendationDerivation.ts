import type {
  Holding,
  PortfolioCrossImpact,
  ProposalData,
  WatchlistData,
} from '@/lib/hooks/useNdlData';
import { isExpired, isExpiringSoon } from '@/lib/utils/time';

export type PortfolioImpact = 'DIRECT' | 'INDIRECT' | 'OUTSIDE' | 'UNKNOWN';
export type RecommendationStatus =
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'VERIFIED'
  | 'EXECUTED'
  | 'MISSING_DATA';

const UNKNOWN_TOKEN_SYMBOL = 'TOKEN CHƯA ĐỊNH DANH';
const EXPIRING_SOON_WINDOW_MS = 6 * 60 * 60 * 1000;

export function normalizeTokenSymbol(value?: string | null) {
  const symbol = value?.trim().toUpperCase();
  if (!symbol || symbol === UNKNOWN_TOKEN_SYMBOL) return null;
  return symbol;
}

export function hasVerificationResult(proposal: ProposalData) {
  return Boolean(
    proposal.backtestedAt ||
    proposal.winLossStatus ||
    proposal.pnlPercentage !== null && proposal.pnlPercentage !== undefined
  );
}

export function hasMissingDecisionData(proposal: ProposalData) {
  const hasPrice = Boolean(
    proposal.financialImpact?.currentPrice !== null && proposal.financialImpact?.currentPrice !== undefined ||
    proposal.financialImpact?.currentValue !== null && proposal.financialImpact?.currentValue !== undefined
  );
  const hasSource = Boolean(proposal.sources?.length || proposal.signalContext?.sources?.length);
  const hasConfidence = proposal.confidence !== null && proposal.confidence !== undefined;

  return !hasPrice || !hasSource || !hasConfidence;
}

export function deriveRecommendationStatus(proposal: ProposalData): RecommendationStatus {
  const status = String(proposal.status ?? proposal.executionStatus ?? '').toLowerCase();
  if (status === 'executed' || status === 'execution_confirmed') return 'EXECUTED';
  if (hasVerificationResult(proposal)) return 'VERIFIED';
  if (isExpired(proposal.expiresAt)) return 'EXPIRED';
  if (hasMissingDecisionData(proposal)) return 'MISSING_DATA';
  if (isExpiringSoon(proposal.expiresAt, EXPIRING_SOON_WINDOW_MS)) return 'EXPIRING_SOON';
  return 'ACTIVE';
}

export function derivePortfolioImpact({
  proposal,
  holdings,
  crossImpacts,
}: {
  proposal: ProposalData;
  holdings?: Holding[];
  crossImpacts?: PortfolioCrossImpact[];
}): PortfolioImpact {
  const token = normalizeTokenSymbol(proposal.tokenSymbol);
  if (!holdings) return 'UNKNOWN';

  const holdingSymbols = new Set(
    holdings
      .map((holding) => normalizeTokenSymbol(holding.symbol))
      .filter((symbol): symbol is string => Boolean(symbol))
  );

  if (token && holdingSymbols.has(token)) return 'DIRECT';
  if (!crossImpacts) return 'UNKNOWN';

  const indirect = crossImpacts.some((impact) => impact.proposalIds?.includes(proposal._id));
  if (indirect) return 'INDIRECT';

  return 'OUTSIDE';
}

export function deriveIsWatched(proposal: ProposalData, watchlist?: WatchlistData) {
  return Boolean(
    watchlist?.some((item) => item.proposalId === proposal._id || item.proposal?._id === proposal._id)
  );
}

export function getPortfolioImpactLabel(impact: PortfolioImpact) {
  if (impact === 'DIRECT') return 'Ảnh hưởng trực tiếp';
  if (impact === 'INDIRECT') return 'Ảnh hưởng gián tiếp';
  if (impact === 'OUTSIDE') return 'Ngoài danh mục';
  return 'Chưa xác định';
}

export function getRecommendationStatusLabel(status: RecommendationStatus) {
  if (status === 'EXPIRING_SOON') return 'Sắp hết hạn';
  if (status === 'EXPIRED') return 'Hết hiệu lực';
  if (status === 'VERIFIED') return 'Đã kiểm chứng';
  if (status === 'EXECUTED') return 'Đã thực hiện';
  if (status === 'MISSING_DATA') return 'Thiếu dữ liệu';
  return 'Còn hiệu lực';
}
