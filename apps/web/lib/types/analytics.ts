export type AnalyticsAction = 'BUY' | 'SELL' | 'HOLD';

export type SignalAnalyticsRow = {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  rank: number;
  deltaRank: number | null;
  signalScore: number;
  deltaSignal: number | null;
  zScore: number | null;
  deltaZScore: number | null;
  momentumAcceleration: number | null;
  sentimentShift: string;
  liquidityShift: number | null;
  volatilityFlag: number | null;
  uncertaintyEntropy?: number | null;
  realizedVolatility?: number | null;
  divergence: string;
  confidence: number;
  action: AnalyticsAction;
  backtest?: {
    actualPnlUsd: number | null;
    dataQuality?: string;
    feePct: number | null;
    grossPnlPct: number | null;
    label: string;
    netPnlPct: number | null;
    outcome: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'NOT_TESTED';
    severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';
    slippagePct: number | null;
  };
  rationaleSummary: string;
  layer2Action: AnalyticsAction;
  layer3Action?: AnalyticsAction;
  proposalId?: string;
  proposalRationaleSummary?: string;
  rationaleBadges?: Array<{ code: string; label: string; severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' }>;
  sources: Array<{ label: string; url: string }>;
  detectedAt: string;
  expiresAt?: string;
  scoreHistory: number[];
  status?: string;
  lifecycleState?: 'QUANT_READY' | 'EXPLANATION_PENDING' | 'EXPLAINED' | 'BACKTESTED';
  confidenceBreakdown?: Array<{
    label: string;
    impact: 'positive' | 'negative' | 'neutral';
  }>;
  scoreComponents?: {
    unifiedRaw?: number;
    timeZ?: number;
    pureAlphaZ?: number;
    crossZ?: number;
    finalScore?: number;
    btcTimeZ?: number;
    crossMean?: number;
    crossStd?: number;
  };
  semantics?: {
    health: {
      badges: Array<{ code: string; label: string; severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' }>;
      code: string;
      label: string;
      severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';
      shouldDim: boolean;
    };
    volatility: {
      label: string;
      level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
      severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';
      value: number | null;
    };
    uncertainty?: {
      label: string;
      level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
      severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';
      value: number | null;
    };
  };
};

export type SignalAnalyticsSummary = {
  totalSignals: number;
  buyCount: number;
  sellCount: number;
  holdCount: number;
  averageConfidence: number;
  strongestToken?: SignalAnalyticsRow;
  weakestToken?: SignalAnalyticsRow;
  anomalyCount: number;
  lastUpdated?: string;
};
