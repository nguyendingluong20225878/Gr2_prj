import type { Holding, ProposalData } from '@/lib/hooks/useNdlData';
import { isExpired } from '@/lib/utils/time';

function tokenKey(value?: string | null) {
  return String(value ?? '').trim().toUpperCase();
}

function getProposalTimestamp(proposal: ProposalData) {
  const createdAt = proposal.createdAt ? new Date(proposal.createdAt).getTime() : NaN;
  if (Number.isFinite(createdAt)) return createdAt;
  const expiresAt = proposal.expiresAt ? new Date(proposal.expiresAt).getTime() : NaN;
  return Number.isFinite(expiresAt) ? expiresAt : 0;
}

export function getHoldingSymbolSet(holdings: Holding[]) {
  return new Set(holdings.map((holding) => tokenKey(holding.symbol)).filter(Boolean));
}

export function isActiveProposal(proposal: ProposalData) {
  return !isExpired(proposal.expiresAt);
}

export function getLatestActiveProposalPerToken(proposals: ProposalData[]) {
  const latestByToken = new Map<string, ProposalData>();

  proposals.forEach((proposal) => {
    const key = tokenKey(proposal.tokenSymbol);
    if (!key || !isActiveProposal(proposal)) return;

    const current = latestByToken.get(key);
    if (!current || getProposalTimestamp(proposal) > getProposalTimestamp(current)) {
      latestByToken.set(key, proposal);
    }
  });

  return [...latestByToken.values()].sort((a, b) => getProposalTimestamp(b) - getProposalTimestamp(a));
}

export function isProposalForHoldings(proposal: ProposalData, holdings: Holding[]) {
  const symbol = tokenKey(proposal.tokenSymbol);
  return Boolean(symbol) && getHoldingSymbolSet(holdings).has(symbol);
}
