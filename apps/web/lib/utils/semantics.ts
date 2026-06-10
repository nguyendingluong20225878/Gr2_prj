export type CanonicalAction = 'BUY' | 'SELL' | 'HOLD';

export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';

export type SignalHealthCode =
  | 'OK'
  | 'PIPELINE_FAILED'
  | 'LOW_HISTORY'
  | 'STALE'
  | 'SIGNAL_ONLY'
  | 'UNKNOWN';

export type BacktestOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'NOT_TESTED';

export type VolatilityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

export type ScoreComponents = {
  unifiedRaw?: number;
  timeZ?: number;
  pureAlphaZ?: number;
  crossZ?: number;
  finalScore?: number;
  btcTimeZ?: number;
  crossMean?: number;
  crossStd?: number;
};

export type SemanticBadge = {
  code: string;
  label: string;
  severity: Severity;
};

export type SignalSemanticsInput = {
  detectedAt?: string | Date;
  metadata?: {
    isNewToken?: boolean;
    sampleSize?: number;
    uncertaintyEntropy?: number;
    volatilityFlag?: number;
    realizedVolatility?: number;
    scoreComponents?: ScoreComponents;
  };
  uncertaintyEntropy?: number | null;
  realizedVolatility?: number | null;
  status?: string;
};

export type BacktestSemanticsInput = {
  actualPnL?: number;
  backtestMeta?: {
    dataQuality?: string;
    feeRate?: number;
    grossPnlPercentage?: number;
    slippageRate?: number;
  };
  pnlPercentage?: number;
  winLossStatus?: string;
};

export function normalizeAction(value?: string | null): CanonicalAction {
  const normalized = value?.toLowerCase();
  if (normalized === 'buy' || normalized === 'stake' || normalized === 'long') return 'BUY';
  if (normalized === 'sell' || normalized === 'close_position' || normalized === 'short') return 'SELL';
  return 'HOLD';
}

export function normalizeConfidence(confidence?: number | null): number {
  if (!Number.isFinite(confidence)) return 0;
  return confidence! <= 1 ? Math.round(confidence! * 100) : Math.round(confidence!);
}

export function normalizePercent(value?: number | null): number | null {
  if (!Number.isFinite(value)) return null;
  const numeric = Number(value);
  return Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
}

export function normalizeVolatility(flag?: number | null): {
  label: string;
  level: VolatilityLevel;
  severity: Severity;
  value: number | null;
} {
  if (!Number.isFinite(flag)) {
    return { label: 'Unknown volatility', level: 'UNKNOWN', severity: 'INFO', value: null };
  }

  const value = Number(flag);
  if (value > 0.5) return { label: 'High volatility', level: 'HIGH', severity: 'HIGH', value };
  if (value < 0.3) return { label: 'Low volatility', level: 'LOW', severity: 'LOW', value };
  return { label: 'Moderate volatility', level: 'MEDIUM', severity: 'MEDIUM', value };
}

export function normalizeUncertaintyEntropy(value?: number | null): {
  label: string;
  level: VolatilityLevel;
  severity: Severity;
  value: number | null;
} {
  if (!Number.isFinite(value)) {
    return { label: 'Unknown sentiment uncertainty', level: 'UNKNOWN', severity: 'INFO', value: null };
  }

  const entropy = Number(value);
  if (entropy > 0.82) return { label: 'High sentiment uncertainty', level: 'HIGH', severity: 'HIGH', value: entropy };
  if (entropy < 0.45) return { label: 'Low sentiment uncertainty', level: 'LOW', severity: 'LOW', value: entropy };
  return { label: 'Moderate sentiment uncertainty', level: 'MEDIUM', severity: 'MEDIUM', value: entropy };
}

export function deriveSignalHealth(input: SignalSemanticsInput): {
  badges: SemanticBadge[];
  code: SignalHealthCode;
  label: string;
  severity: Severity;
  shouldDim: boolean;
} {
  const badges: SemanticBadge[] = [];
  const rawStatus = input.status?.toUpperCase();
  const sampleSize = input.metadata?.sampleSize;
  const entropy = input.uncertaintyEntropy ?? input.metadata?.uncertaintyEntropy ?? input.metadata?.volatilityFlag;

  if (rawStatus === 'FAILED') {
    badges.push({
      code: 'PIPELINE_FAILED',
      label: 'Pipeline status failed',
      severity: 'HIGH',
    });
  }

  if (input.metadata?.isNewToken || sampleSize === 0) {
    badges.push({
      code: 'LOW_HISTORY',
      label: 'Low historical data',
      severity: 'MEDIUM',
    });
  }

  if (Number.isFinite(entropy) && Number(entropy) > 0.9) {
    badges.push({
      code: 'HIGH_SENTIMENT_UNCERTAINTY',
      label: 'High sentiment uncertainty',
      severity: 'MEDIUM',
    });
  }

  if (input.detectedAt) {
    const ageMs = Date.now() - new Date(input.detectedAt).getTime();
    if (Number.isFinite(ageMs) && ageMs > 24 * 60 * 60 * 1000) {
      badges.push({
        code: 'STALE',
        label: 'Signal older than 24h',
        severity: 'MEDIUM',
      });
    }
  }

  if (badges.length === 0) {
    return {
      badges: [{ code: 'OK', label: 'Signal health OK', severity: 'LOW' }],
      code: 'OK',
      label: 'Signal health OK',
      severity: 'LOW',
      shouldDim: false,
    };
  }

  const primary = badges.find((badge) => badge.severity === 'HIGH') || badges[0];
  return {
    badges,
    code: primary.code as SignalHealthCode,
    label: primary.label,
    severity: primary.severity,
    shouldDim: primary.severity === 'HIGH',
  };
}

export function deriveLayerConflict(layer2Action?: string | null, layer3Action?: string | null): {
  hasConflict: boolean;
  label: string;
  layer2Action: CanonicalAction;
  layer3Action: CanonicalAction;
  severity: Severity;
} {
  const l2 = normalizeAction(layer2Action);
  const l3 = normalizeAction(layer3Action);
  const hasConflict = l2 !== l3;

  return {
    hasConflict,
    label: hasConflict
      ? `Quant model says ${l2}, AI proposal says ${l3}`
      : `Quant and AI both say ${l3}`,
    layer2Action: l2,
    layer3Action: l3,
    severity: hasConflict ? 'HIGH' : 'LOW',
  };
}

export function deriveBacktestSemantics(input: BacktestSemanticsInput): {
  actualPnlUsd: number | null;
  dataQuality?: string;
  feePct: number | null;
  grossPnlPct: number | null;
  label: string;
  netPnlPct: number | null;
  outcome: BacktestOutcome;
  severity: Severity;
  slippagePct: number | null;
} {
  const netPnlPct = normalizePercent(input.pnlPercentage);
  const grossPnlPct = normalizePercent(input.backtestMeta?.grossPnlPercentage);
  const feePct = normalizePercent(input.backtestMeta?.feeRate);
  const slippagePct = normalizePercent(input.backtestMeta?.slippageRate);
  const actualPnlUsd = Number.isFinite(input.actualPnL) ? Number(input.actualPnL) : null;
  const status = input.winLossStatus?.toUpperCase();

  let outcome: BacktestOutcome = 'NOT_TESTED';
  if (status === 'WIN' || status === 'LOSS') outcome = status;
  else if (netPnlPct !== null) {
    if (netPnlPct > 0) outcome = 'WIN';
    else if (netPnlPct < 0) outcome = 'LOSS';
    else outcome = 'BREAKEVEN';
  }

  return {
    actualPnlUsd,
    dataQuality: input.backtestMeta?.dataQuality,
    feePct,
    grossPnlPct,
    label: outcome === 'NOT_TESTED' ? 'No backtest result' : `Backtest ${outcome}`,
    netPnlPct,
    outcome,
    severity: outcome === 'LOSS' ? 'HIGH' : outcome === 'WIN' ? 'LOW' : 'INFO',
    slippagePct,
  };
}

export function extractRationaleBadges(rationale?: string): SemanticBadge[] {
  const text = rationale?.toLowerCase() || '';
  const badges: SemanticBadge[] = [];

  if (text.includes('khởi động lạnh') || text.includes('cold start')) {
    badges.push({
      code: 'COLD_START',
      label: 'Low historical data - higher risk',
      severity: 'MEDIUM',
    });
  }

  if (text.includes('trượt giá') || text.includes('slippage')) {
    badges.push({
      code: 'SLIPPAGE_MENTIONED',
      label: 'Slippage risk mentioned',
      severity: 'MEDIUM',
    });
  }

  if (text.includes('stable') || text.includes('usdt') || text.includes('usdc')) {
    badges.push({
      code: 'STABLECOIN_CONTEXT',
      label: 'Stablecoin / liquidity context',
      severity: 'INFO',
    });
  }

  return badges;
}
