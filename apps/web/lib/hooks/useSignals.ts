import { useCallback, useEffect, useState } from 'react';
import { demoScenario } from '@/lib/demo/mockScenario';

export interface SignalUI {
  _id: string;
  enrichedProposal?: {
    _id: string;
    action: 'BUY' | 'SELL' | 'HOLD';
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
    confidence: number;
    executionStatus?: string;
    pnlPercentage?: number;
    quantScore?: number;
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
    volatilityFlag?: number | null;
    uncertaintyEntropy?: number | null;
    realizedVolatility?: number | null;
    rationaleBadges?: Array<{ code: string; label: string; severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' }>;
    rationaleSummary?: string;
    status?: string;
    suggestionType?: string;
    tokenSymbol?: string;
    winLossStatus?: string;
  };
  metadata?: {
    isNewToken?: boolean;
    sampleSize?: number;
    volatilityFlag?: number;
    uncertaintyEntropy?: number;
    realizedVolatility?: number;
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
  };
  quantScore?: number;
  uncertaintyEntropy?: number | null;
  realizedVolatility?: number | null;
  status?: string;
  tokenAddress: string;
  tokenSymbol?: string;
  sentimentType: 'positive' | 'negative' | 'neutral';
  suggestionType: 'buy' | 'sell' | 'hold' | 'stake' | 'close_position';
  confidence: number;
  rationaleSummary: string;
  sources: { label: string; url: string }[];
  detectedAt: string;
  expiresAt: string;
  dataQuality?: 'REAL' | 'DEMO' | 'EMPTY' | 'ERROR';
  lifecycleState?: 'QUANT_READY' | 'EXPLANATION_PENDING' | 'EXPLAINED' | 'BACKTESTED';
  confidenceBreakdown?: Array<{
    label: string;
    impact: 'positive' | 'negative' | 'neutral';
  }>;
}

type SignalsApiResponse =
  | SignalUI[]
  | {
      data: SignalUI[];
      nextCursor: string | null;
      cache?: 'HIT' | 'MISS';
      latencyMs?: number;
    };

export function useSignals() {
  const forceDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const [signals, setSignals] = useState<SignalUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoReason, setDemoReason] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const fetchSignals = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      setError(null);

      if (forceDemoMode) {
        setSignals(demoScenario.signals.map((signal) => ({ ...signal, dataQuality: 'DEMO' })));
        setIsDemoMode(true);
        setDemoReason('NEXT_PUBLIC_DEMO_MODE=true, using cached defense scenario.');
        setLastUpdatedAt(new Date().toISOString());
        return;
      }

      const res = await fetch('/api/signals?meta=1');
      if (!res.ok) throw new Error('Failed to fetch signals');

      const body = (await res.json()) as SignalsApiResponse;
      const data = Array.isArray(body) ? body : body.data;
      const safeSignals = Array.isArray(data) ? data.map((signal) => ({ ...signal, dataQuality: 'REAL' as const })) : [];
      setSignals(safeSignals);
      setIsDemoMode(false);
      setDemoReason(safeSignals.length === 0 ? 'Backend returned no signals.' : null);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch signals';
      setSignals([]);
      setError(message);
      setIsDemoMode(false);
      setDemoReason(null);
      setLastUpdatedAt(new Date().toISOString());
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [forceDemoMode]);

  useEffect(() => {
    void fetchSignals();
    const interval = window.setInterval(() => void fetchSignals({ silent: true }), 30000);
    return () => window.clearInterval(interval);
  }, [fetchSignals]);

  return { demoReason, error, isDemoMode, lastUpdatedAt, loading, refetch: fetchSignals, signals };
}
