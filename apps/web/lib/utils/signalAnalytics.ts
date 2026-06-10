import { resolveTokenDisplay } from '@/lib/constants/tokens';
import type { SignalUI } from '@/lib/hooks/useSignals';
import type { AnalyticsAction, SignalAnalyticsRow, SignalAnalyticsSummary } from '@/lib/types/analytics';
import { deriveSignalHealth, normalizeAction, normalizeConfidence, normalizeUncertaintyEntropy, normalizeVolatility } from '@/lib/utils/semantics';

type SignalWithQuant = SignalUI & {
  enrichedProposal?: SignalUI['enrichedProposal'];
  tokenSymbol?: string;
  tokenName?: string;
  quantScore?: number;
  directionScore?: number;
  volatilityFlag?: number | null;
  uncertaintyEntropy?: number | null;
  realizedVolatility?: number | null;
  status?: string;
  lifecycleState?: 'QUANT_READY' | 'EXPLANATION_PENDING' | 'EXPLAINED' | 'BACKTESTED';
  confidenceBreakdown?: Array<{
    label: string;
    impact: 'positive' | 'negative' | 'neutral';
  }>;
  metadata?: {
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
    previous?: {
      rank?: number;
      signalScore?: number;
      zScore?: number;
      liquidity?: number;
      sentimentType?: string;
    };
  };
};

function toAction(type?: string): AnalyticsAction {
  return normalizeAction(type);
}

function scoreFromSignal(signal: SignalWithQuant): number {
  const components = signal.metadata?.scoreComponents;
  const score = signal.quantScore ?? components?.finalScore ?? components?.pureAlphaZ ?? components?.timeZ;
  if (Number.isFinite(score)) return Number(score);

  const confidence = normalizeConfidence(signal.confidence) / 100;
  if (signal.sentimentType === 'negative') return -confidence;
  if (signal.sentimentType === 'positive') return confidence;
  return 0;
}

function classifyDivergence(row: Pick<SignalAnalyticsRow, 'signalScore' | 'confidence' | 'uncertaintyEntropy' | 'realizedVolatility' | 'action' | 'backtest' | 'semantics'>) {
  if (row.backtest?.outcome === 'LOSS') return 'Backtested loss';
  if (row.semantics?.health.severity === 'HIGH') return 'Signal health issue';
  if (row.realizedVolatility !== null && row.realizedVolatility !== undefined && row.realizedVolatility > 0.5) return 'Volatility anomaly';
  if (row.uncertaintyEntropy !== null && row.uncertaintyEntropy !== undefined && row.uncertaintyEntropy > 0.82) return 'Sentiment uncertainty';
  if (Math.abs(row.signalScore) > 1.5 && row.confidence < 45) return 'Score/confidence conflict';
  if (row.action === 'HOLD' && Math.abs(row.signalScore) > 1) return 'Strong score held';
  return 'None';
}

function syntheticHistory(score: number, delta: number | null) {
  if (delta === null) return [score];
  return [score - delta, score - delta * 0.5, score];
}

function latestTimestamp(rows: Array<Pick<SignalAnalyticsRow, 'detectedAt'>>) {
  const latest = rows.reduce<number | null>((max, row) => {
    const time = row.detectedAt ? new Date(row.detectedAt).getTime() : NaN;
    if (!Number.isFinite(time)) return max;
    return max === null || time > max ? time : max;
  }, null);

  return latest === null ? undefined : new Date(latest).toISOString();
}

export function buildSignalAnalytics(signals: SignalWithQuant[]): {
  rows: SignalAnalyticsRow[];
  summary: SignalAnalyticsSummary;
} {
  const sorted = [...signals].sort((a, b) => Math.abs(scoreFromSignal(b)) - Math.abs(scoreFromSignal(a)));

  const rows = sorted.map((signal, index) => {
    const token = signal.tokenSymbol
      ? { symbol: signal.tokenSymbol, name: signal.tokenName || signal.tokenSymbol }
      : resolveTokenDisplay(signal.tokenAddress);
    const signalScore = scoreFromSignal(signal);
    const layer2Action = toAction(signal.suggestionType);
    const layer3Action = signal.enrichedProposal?.action;
    const action = layer3Action || layer2Action;
    const previous = signal.metadata?.previous;
    const deltaSignal = Number.isFinite(previous?.signalScore) ? signalScore - Number(previous?.signalScore) : null;
    const zScore = signal.metadata?.scoreComponents?.timeZ ?? signal.metadata?.scoreComponents?.pureAlphaZ ?? signalScore;
    const deltaZScore = Number.isFinite(previous?.zScore) ? Number(zScore) - Number(previous?.zScore) : null;
    const deltaRank = Number.isFinite(previous?.rank) ? Number(previous?.rank) - (index + 1) : null;
    const volatilityFlag = Number.isFinite(signal.volatilityFlag) ? Number(signal.volatilityFlag) : null;
    const uncertaintyEntropy = Number.isFinite(signal.uncertaintyEntropy)
      ? Number(signal.uncertaintyEntropy)
      : Number.isFinite(signal.metadata?.uncertaintyEntropy)
        ? Number(signal.metadata?.uncertaintyEntropy)
        : volatilityFlag;
    const realizedVolatility = Number.isFinite(signal.realizedVolatility)
      ? Number(signal.realizedVolatility)
      : Number.isFinite(signal.metadata?.realizedVolatility)
        ? Number(signal.metadata?.realizedVolatility)
        : null;
    const liquidityShift = Number.isFinite(previous?.liquidity) ? Number(previous?.liquidity) : null;
    const sentimentShift = previous?.sentimentType && previous.sentimentType !== signal.sentimentType
      ? `${previous.sentimentType} -> ${signal.sentimentType}`
      : signal.sentimentType;

    const row: SignalAnalyticsRow = {
      id: signal._id,
      tokenAddress: signal.tokenAddress,
      tokenSymbol: token.symbol,
      tokenName: token.name,
      rank: index + 1,
      deltaRank,
      signalScore,
      deltaSignal,
      zScore: Number.isFinite(zScore) ? Number(zScore) : null,
      deltaZScore,
      momentumAcceleration: deltaSignal !== null && deltaZScore !== null ? deltaSignal + deltaZScore * 0.35 : null,
      sentimentShift,
      liquidityShift,
      volatilityFlag,
      uncertaintyEntropy,
      realizedVolatility,
      divergence: 'None',
      confidence: normalizeConfidence(signal.confidence),
      action,
      backtest: signal.enrichedProposal?.backtest,
      rationaleSummary: signal.enrichedProposal?.rationaleSummary || signal.rationaleSummary,
      layer2Action,
      layer3Action,
      proposalId: signal.enrichedProposal?._id,
      proposalRationaleSummary: signal.enrichedProposal?.rationaleSummary,
      rationaleBadges: signal.enrichedProposal?.rationaleBadges,
      sources: signal.sources || [],
      detectedAt: signal.detectedAt,
      expiresAt: signal.expiresAt,
      scoreHistory: syntheticHistory(signalScore, deltaSignal),
      status: signal.status,
      lifecycleState: signal.lifecycleState,
      confidenceBreakdown: signal.confidenceBreakdown,
      scoreComponents: signal.metadata?.scoreComponents,
      semantics: {
        health: deriveSignalHealth(signal),
        volatility: normalizeVolatility(realizedVolatility),
        uncertainty: normalizeUncertaintyEntropy(uncertaintyEntropy),
      },
    };

    row.divergence = classifyDivergence(row);
    return row;
  });

  const buyCount = rows.filter((row) => row.action === 'BUY').length;
  const sellCount = rows.filter((row) => row.action === 'SELL').length;
  const holdCount = rows.filter((row) => row.action === 'HOLD').length;
  const averageConfidence = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length)
    : 0;

  return {
    rows,
    summary: {
      totalSignals: rows.length,
      buyCount,
      sellCount,
      holdCount,
      averageConfidence,
      strongestToken: rows.find((row) => row.signalScore > 0),
      weakestToken: [...rows].reverse().find((row) => row.signalScore < 0),
      anomalyCount: rows.filter((row) => row.divergence !== 'None').length,
      lastUpdated: latestTimestamp(rows),
    },
  };
}
