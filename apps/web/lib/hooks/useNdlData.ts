'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { useWallet } from '@solana/wallet-adapter-react';

export type Holding = {
  tokenAddress?: string;
  symbol: string;
  balance?: number | null;
  price?: number | null;
  value?: number | null;
  dataQuality?: 'OK' | 'MISSING_PRICE' | string;
  missingReason?: 'NO_TOKEN_MAPPING' | 'NO_PRICE' | string;
};

export type Investment = {
  _id: string;
  symbol?: string;
  tokenSymbol?: string;
  entryPrice?: number | null;
  size?: number | null;
  leverage?: number | null;
  direction?: string | null;
  proposalId?: string | null;
  requestedPrice?: number | null;
  executedPrice?: number | null;
  executionId?: string | null;
  slippagePct?: number | null;
  roi?: number | null;
  pnl?: number | null;
  txHash?: string | null;
};

export type PortfolioData = {
  holdings: Holding[];
  investments: Investment[];
  watchlist: Array<{
    _id: string;
    tokenSymbol?: string;
    title?: string;
    roi?: number | null;
    confidence?: number | null;
    createdAt?: string;
    expiresAt?: string;
  }>;
  stats?: {
    totalValue?: number | null;
    activeCount?: number | null;
    watchlistCount?: number | null;
    pricedHoldingsCount?: number | null;
    missingPriceCount?: number | null;
    totalValueStatus?: 'COMPLETE' | 'PARTIAL' | 'MISSING_PRICE_DATA' | string;
  };
};

export type ProposalData = {
  _id: string;
  signalId?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenAddress?: string;
  action?: string;
  suggestionType?: string;
  title?: string;
  summary?: string;
  rationaleSummary?: string;
  reason?: string[];
  sources?: Array<string | { label?: string; name?: string; url?: string }>;
  confidence?: number | null;
  quantScore?: number | null;
  sentimentType?: string;
  financialImpact?: {
    currentValue?: number | null;
    currentPrice?: number | null;
    projectedValue?: number | null;
    projectedPnL?: number | null;
    targetPrice?: number | null;
    roi?: number | null;
    percentChange?: number | null;
    riskLevel?: string | null;
  };
  roiStatus?: 'AVAILABLE' | 'NOT_AVAILABLE' | string;
  entryPrice?: number | null;
  exitPrice?: number | null;
  actualPnL?: number | null;
  pnlPercentage?: number | null;
  winLossStatus?: string | null;
  backtestedAt?: string | null;
  livePerformance?: {
    entryPrice: number | null;
    entryMatchedAt: string | null;
    markPrice: number | null;
    markMatchedAt: string | null;
    roiPct: number | null;
    pnlStatus: 'AVAILABLE' | 'NO_ENTRY_PRICE' | 'NO_MARK_PRICE' | 'UNSUPPORTED_ACTION';
    basis: 'MARK_TO_MARKET';
  };
  backtestMeta?: {
    dataQuality?: string;
    detectedAt?: string;
    entryTimestamp?: string;
    exitTimestamp?: string;
    feeRate?: number | null;
    grossPnlPercentage?: number | null;
    notionalUsd?: number | null;
    slippageRate?: number | null;
  };
  scoreComponents?: {
    unifiedRaw?: number;
    timeZ?: number;
    pureAlphaZ?: number;
    crossZ?: number;
    finalScore?: number;
  };
  signalContext?: SignalData;
  signalMode?: 'COLD_START' | 'NORMALIZED_ALPHA' | string;
  uncertaintyEntropy?: number | null;
  realizedVolatility?: number | null;
  executionStatus?: string;
  lifecycleStatus?: string | null;
  status?: string | null;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ScoreExplanationData = {
  displayConfidence?: number | null;
  confidenceLevel?: 'LOW' | 'MEDIUM' | 'STRONG' | 'VERY_STRONG' | 'UNKNOWN';
  primaryExplanation?: string;
  reasonCards?: Array<{
    id: 'input_signal' | 'source_quality' | 'thin_data' | 'cold_start';
    title: string;
    body: string;
    status: 'SUPPORTED' | 'LIMITED' | 'MISSING' | 'INFO';
    tone: 'positive' | 'caution' | 'neutral';
    visible: boolean;
    sourceFields?: string[];
  }>;
  hasThinData?: boolean;
  isColdStart?: boolean;
  sourceStatus?: 'OK' | 'LIMITED' | 'MISSING';
  inputSignalStatus?: 'SUPPORTED' | 'LIMITED' | 'MISSING';
  auditAvailable?: boolean;
  confidenceFormula: string;
  quantFormula: string;
  quantFormulaMode?: 'ALPHA_BLEND' | 'PURE_ALPHA_FALLBACK' | 'MISSING_INPUTS' | string;
  alphaBlendDefault?: number | null;
  alphaBlendSource?: 'model' | 'default' | 'missing' | string;
  signalMode?: 'COLD_START' | 'NORMALIZED_ALPHA' | string | null;
  sampleSize?: number | null;
  thresholds: {
    actionThreshold?: number | null;
    alphaBlend?: number | null;
    coldStartActionThreshold?: number | null;
    confidenceDivisor?: number | null;
    coldStartConfidenceDivisor?: number | null;
    signalThreshold?: number | null;
  };
  scoreComponents?: ProposalData['scoreComponents'] & Record<string, unknown>;
  finalScore?: number | null;
  confidence?: number | null;
  confidenceCap?: number | null;
  sampleSizePenalty?: number | null;
  positiveFactors: string[];
  negativeFactors: string[];
  missingData: string[];
  dataSources?: Array<{ label: string; status: 'OK' | 'MISSING' | 'LIMITED'; detail: string }>;
  componentDescriptions?: Record<string, string>;
  trustChecklist?: Array<{ label: string; status: 'OK' | 'LIMITED' | 'MISSING'; detail: string }>;
  cautionChecklist?: Array<{ label: string; detail: string }>;
  auditTrail: Array<{ step: string; detail: string; status: 'OK' | 'MISSING' | 'LIMITED' }>;
};

export type ProposalTimelineData = {
  token: {
    symbol?: string | null;
    address?: string | null;
  };
  priceCoverage?: {
    startAt?: string | null;
    endAt?: string | null;
    pointCount: number;
    medianGapMs?: number | null;
    maxAllowedMarkerGapMs?: number | null;
  };
  priceHistory: Array<{
    timestamp: string;
    price: number;
    source?: string;
  }>;
  currentProposal: ProposalTimelineMarker | null;
  historicalProposals: ProposalTimelineMarker[];
  backtestResults: Array<{
    proposalId: string;
    result: 'Win' | 'Loss' | 'Pending' | 'Breakeven';
    pnlPercentage?: number | null;
    entryPrice?: number | null;
    exitPrice?: number | null;
    expirationTime?: string | null;
  }>;
  missingData: string[];
};

export type ProposalTimelineMarker = {
  id: string;
  date?: string | null;
  dateSource?: 'SIGNAL_DETECTED_AT' | 'BACKTEST_DETECTED_AT' | 'PROPOSAL_CREATED_AT' | 'UNKNOWN';
  action: 'BUY' | 'SELL' | 'HOLD' | string;
  confidence?: number | null;
  quant?: number | null;
  result: 'Win' | 'Loss' | 'Pending' | 'Breakeven';
  pnlPercentage?: number | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  expirationTime?: string | null;
  isCurrent?: boolean;
  priceStatus?: 'MATCHED' | 'OUT_OF_RANGE' | 'PRICE_GAP_TOO_LARGE' | 'NO_PRICE_HISTORY';
  markerPrice?: number | null;
  matchedPriceAt?: string | null;
  priceGapMs?: number | null;
};

export type SignalData = {
  _id: string;
  tokenSymbol?: string;
  tokenAddress?: string;
  suggestionType?: string;
  sentimentType?: string;
  confidence?: number | null;
  quantScore?: number | null;
  rationaleSummary?: string;
  sources?: Array<{ label?: string; url?: string; sourceKey?: string; weight?: number }>;
  detectedAt?: string;
  expiresAt?: string;
  status?: string;
  lifecycleState?: string;
  metadata?: {
    sampleSize?: number;
    isNewToken?: boolean;
    scoreComponents?: ProposalData['scoreComponents'];
    uncertaintyEntropy?: number;
    realizedVolatility?: number;
    volatilityFlag?: number;
  };
  enrichedProposal?: ProposalData & {
    backtest?: {
      outcome?: string;
      netPnlPct?: number | null;
      grossPnlPct?: number | null;
      actualPnlUsd?: number | null;
      dataQuality?: string;
    };
  };
  confidenceBreakdown?: Array<{ label: string; impact: 'positive' | 'negative' | 'neutral' }>;
  uncertaintyEntropy?: number | null;
  realizedVolatility?: number | null;
};

export type ModelHealthData = {
  activeConfig?: {
    id?: string;
    status?: string;
    params?: Record<string, unknown>;
    metrics?: Record<string, unknown>;
    promotedAt?: string;
    updatedAt?: string;
  } | null;
  latestBacktestRun?: {
    id?: string;
    status?: string;
    optimizer?: string;
    trainWindow?: unknown;
    validationWindow?: unknown;
    metrics?: Record<string, unknown>;
    startedAt?: string;
    endedAt?: string;
  } | null;
  latencyMs?: number;
};

export type WatchlistData = Array<{
  _id?: string;
  proposalId: string;
  userId?: string | null;
  walletAddress?: string | null;
  addedBy: 'USER' | 'SYSTEM';
  reason?: string | null;
  status: 'WATCHING' | 'RESOLVED' | 'EXPIRED';
  addedAt: string;
  resolvedAt?: string | null;
  proposal?: ProposalData | null;
}>;

export type PortfolioCrossImpact = {
  sourceId?: string;
  sourceLabel: string;
  sourceUrl?: string;
  sourceType?: 'news' | 'tweet' | string;
  holdingTokens: string[];
  impactedTokens: string[];
  proposalIds: string[];
  confidence?: number | null;
  weight?: number | null;
  reason: string;
  createdAt?: string;
};

const fetcher = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || body.details || `Không tải được dữ liệu từ ${url}`);
  }
  return response.json();
};

function normalizeSignalResponse(body: SignalData[] | { data?: SignalData[] }) {
  return Array.isArray(body) ? body : body.data ?? [];
}

export function useNdlData() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();
  const portfolioKey = '/api/portfolio';
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const markSynced = useCallback(() => setLastSyncedAt(Date.now()), []);

  const portfolio = useSWR<PortfolioData>(portfolioKey, fetcher, {
    dedupingInterval: 30_000,
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    onSuccess: markSynced,
  });
  const proposals = useSWR<ProposalData[]>('/api/proposals', fetcher, {
    dedupingInterval: 30_000,
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    onSuccess: markSynced,
  });
  const signals = useSWR<SignalData[]>('/api/signals?limit=100&type=ALL&meta=1', async (url: string) => {
    const body = await fetcher<SignalData[] | { data?: SignalData[] }>(url);
    return normalizeSignalResponse(body);
  }, {
    dedupingInterval: 30_000,
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    onSuccess: markSynced,
  });
  const modelHealth = useSWR<ModelHealthData>('/api/model-health', fetcher, {
    dedupingInterval: 60_000,
    revalidateOnFocus: true,
    onSuccess: markSynced,
  });
  const watchlist = useSWR<WatchlistData>('/api/watchlist', fetcher, {
    dedupingInterval: 30_000,
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    onSuccess: markSynced,
  });
  const crossImpacts = useSWR<PortfolioCrossImpact[]>('/api/portfolio/cross-impacts', fetcher, {
    dedupingInterval: 60_000,
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    onSuccess: markSynced,
  });

  return {
    walletAddress,
    portfolio,
    proposals,
    signals,
    modelHealth,
    watchlist,
    crossImpacts,
    lastSyncedAt,
    isLoading: Boolean(portfolio.isLoading || proposals.isLoading || signals.isLoading),
  };
}

export function useProposalDetail(id?: string) {
  return useSWR<ProposalData>(id ? `/api/proposals/${id}` : null, fetcher, {
    dedupingInterval: 30_000,
    revalidateOnFocus: false,
  });
}

export function useProposalScoreExplanation(id?: string) {
  return useSWR<ScoreExplanationData>(id ? `/api/proposals/${id}/score-explanation` : null, fetcher, {
    dedupingInterval: 30_000,
    revalidateOnFocus: false,
  });
}

export function useProposalTimeline(id?: string) {
  return useSWR<ProposalTimelineData>(id ? `/api/proposals/${id}/timeline` : null, fetcher, {
    dedupingInterval: 30_000,
    revalidateOnFocus: false,
  });
}

export function useSignalDetail(id?: string) {
  return useSWR<SignalData>(id ? `/api/signals/${id}` : null, fetcher, {
    dedupingInterval: 30_000,
    revalidateOnFocus: false,
  });
}
