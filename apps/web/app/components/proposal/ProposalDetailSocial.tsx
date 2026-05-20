'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useSignalAnalytics } from '@/lib/hooks/useSignalAnalytics';
import type { SignalAnalyticsRow } from '@/lib/types/analytics';
import { toast } from 'sonner';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { RiskSimulation } from './RiskSimulation';
import { TheEvidence } from './TheEvidence';
import { TheLogic } from './TheLogic';
import { TheNumbers } from './TheNumbers';

type ProposalDetailData = {
  _id: string;
  action?: string;
  confidence?: number;
  expiresAt?: string | Date;
  financialImpact?: {
    currentValue?: number;
    projectedValue?: number;
    percentChange?: number;
    riskLevel?: string;
    roi?: number;
  };
  reason?: string[];
  signalId?: string;
  sources?: Array<{ label?: string; url?: string }>;
  status?: string;
  summary?: string;
  title?: string;
  tokenSymbol?: string;
  triggerEventId?: string;
  triggerSignalId?: string;
};

type SignalDetailData = {
  sources?: Array<{ label?: string; url?: string }>;
  sentimentType?: string;
  rationaleSummary?: string;
};

interface ProposalDetailSocialProps {
  onBack?: () => void;
}

function normalizeConfidence(confidence?: number) {
  if (!Number.isFinite(confidence)) return 0;
  return confidence! <= 1 ? Math.round(confidence! * 100) : Math.round(confidence!);
}

function formatTime(value?: string | Date) {
  if (!value) return 'No expiry';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value) || value === 0) return 'Unavailable';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 2 : 6,
  }).format(value);
}

function getActionConfig(action: string) {
  if (action === 'BUY') {
    return {
      border: 'border-green-500/40',
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      button: 'from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500',
      icon: CheckCircle2,
    };
  }

  if (action === 'SELL') {
    return {
      border: 'border-red-500/40',
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      button: 'from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500',
      icon: ShieldAlert,
    };
  }

  return {
    border: 'border-purple-500/40',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    button: 'from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500',
    icon: ShieldCheck,
  };
}

function SignalQualityComparison({
  action,
  confidence,
  currentSignalId,
  tokenSymbol,
}: {
  action: string;
  confidence: number;
  currentSignalId?: string;
  tokenSymbol: string;
}) {
  const { rows, loading } = useSignalAnalytics();

  const comparison = useMemo(() => {
    const tokenRows = rows
      .filter((row) => row.tokenSymbol.toUpperCase() === tokenSymbol.toUpperCase())
      .sort((a, b) => new Date(a.detectedAt || 0).getTime() - new Date(b.detectedAt || 0).getTime());

    const currentRow =
      tokenRows.find((row) => row.id === currentSignalId) ||
      tokenRows.find((row) => row.action === action) ||
      tokenRows[tokenRows.length - 1];

    const historyRows = tokenRows
      .filter((row) => row.id !== currentRow?.id)
      .filter((row) => row.action === action || action === 'HOLD')
      .slice(-5);

    const chartRows = [
      ...historyRows.map((row, index) => ({
        confidence: row.confidence,
        label: `Past ${historyRows.length - index}`,
        score: Number(row.signalScore.toFixed(2)),
        zScore: row.zScore === null ? 0 : Number(row.zScore.toFixed(2)),
      })),
      {
        confidence,
        label: 'Current',
        score: Number((currentRow?.signalScore ?? 0).toFixed(2)),
        zScore: currentRow?.zScore === null || currentRow?.zScore === undefined ? 0 : Number(currentRow.zScore.toFixed(2)),
      },
    ];

    const historicalScores = historyRows.map((row) => Math.abs(row.signalScore));
    const currentScore = Math.abs(currentRow?.signalScore ?? 0);
    const averageHistoricalScore = historicalScores.length
      ? historicalScores.reduce((sum, score) => sum + score, 0) / historicalScores.length
      : 0;

    let verdict = 'Not enough history';
    let tone = 'text-slate-400';
    if (historicalScores.length > 0) {
      if (currentScore > averageHistoricalScore * 1.2) {
        verdict = 'Stronger than recent history';
        tone = 'text-green-400';
      } else if (currentScore < averageHistoricalScore * 0.8) {
        verdict = 'Weaker than recent history';
        tone = 'text-amber-300';
      } else {
        verdict = 'In line with recent history';
        tone = 'text-cyan-300';
      }
    }

    return {
      averageHistoricalScore,
      chartRows,
      currentScore,
      historyCount: historyRows.length,
      tone,
      verdict,
    };
  }, [action, confidence, currentSignalId, rows, tokenSymbol]);

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-bold mb-2">Signal Quality Check</p>
          <h2 className="text-2xl font-bold gradient-text">Current Signal vs History</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Compares this setup with recent signals for the same token/action so the decision is not based on one isolated score.
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/40 p-4 min-w-[220px]">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Quality verdict</p>
          <p className={`mt-2 font-bold ${comparison.tone}`}>{loading ? 'Loading history...' : comparison.verdict}</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-8 text-center text-slate-500">
          Loading signal history...
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5">
          <div className="h-[280px] rounded-xl border border-white/5 bg-black/40 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={comparison.chartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(34,211,238,0.08)' }}
                  contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)', color: '#e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="score" name="Signal score" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                <Bar dataKey="confidence" name="Confidence" fill="#a855f7" radius={[6, 6, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {[
              { label: 'History samples', value: comparison.historyCount },
              { label: 'Current strength', value: comparison.currentScore.toFixed(2) },
              { label: 'Recent avg strength', value: comparison.averageHistoricalScore.toFixed(2) },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/5 bg-black/40 p-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.label}</p>
                <p className="mt-2 text-xl font-bold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function ProposalDetailSocial({ onBack }: ProposalDetailSocialProps) {
  const router = useRouter();
  const params = useParams();
  const { connected } = useWallet();

  const [proposal, setProposal] = useState<ProposalDetailData | null>(null);
  const [signal, setSignal] = useState<SignalDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!params?.id) return;
      setLoading(true);

      try {
        const propRes = await fetch(`/api/proposals/${params.id}`);
        if (!propRes.ok) throw new Error('Proposal not found');

        const propData = (await propRes.json()) as ProposalDetailData;
        setProposal(propData);

        const signalId = propData.triggerSignalId || propData.triggerEventId || propData.signalId;
        if (signalId) {
          const sigRes = await fetch(`/api/signals/${signalId}`);
          if (sigRes.ok) {
            setSignal((await sigRes.json()) as SignalDetailData);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cannot load proposal.';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params.id]);

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  const decision = useMemo(() => {
    if (!proposal) return null;

    const action = proposal.action?.toUpperCase() || 'HOLD';
    const confidence = normalizeConfidence(proposal.confidence);
    const roi = proposal.financialImpact?.roi ?? proposal.financialImpact?.percentChange ?? 0;
    const currentValue = proposal.financialImpact?.currentValue || 0;
    const projectedValue = proposal.financialImpact?.projectedValue || 0;
    const riskLevel = (proposal.financialImpact?.riskLevel || 'MEDIUM').toUpperCase();
    const isSignalOnly = proposal.status === 'signal-only';
    const canExecute = action !== 'HOLD' && !isSignalOnly && currentValue > 0 && connected;
    const tokenSymbol = proposal.tokenSymbol || (proposal.title ? proposal.title.split(' ')[0] : 'TOKEN');

    return {
      action,
      canExecute,
      confidence,
      currentValue,
      isSignalOnly,
      projectedValue,
      riskLevel,
      roi,
      tokenSymbol,
    };
  }, [connected, proposal]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!proposal || !decision) {
    return (
      <div className="glass-card rounded-xl border border-red-500/30 p-10 text-center text-red-300">
        Proposal not found.
      </div>
    );
  }

  const actionConfig = getActionConfig(decision.action);
  const ActionIcon = actionConfig.icon;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={handleBack} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="mr-2 h-5 w-5" /> Back
        </Button>
        <span className="rounded-md border border-cyan-500/30 px-2 py-1 font-mono text-xs text-cyan-400">
          {(proposal.status || 'ACTIVE').toUpperCase()}
        </span>
      </div>

      <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Decision Page</p>
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-purple-cyan shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                <span className="text-xl font-black text-white">{decision.tokenSymbol.slice(0, 2)}</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-bold gradient-text md:text-4xl">
                  {proposal.title || `${decision.tokenSymbol} ${decision.action} setup`}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                  {proposal.summary || signal?.rationaleSummary || 'No summary is available for this proposal.'}
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl border ${actionConfig.border} ${actionConfig.bg} p-4 min-w-[220px]`}>
            <div className="flex items-center gap-3">
              <ActionIcon className={`h-6 w-6 ${actionConfig.text}`} />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Recommended action</p>
                <p className={`text-3xl font-black ${actionConfig.text}`}>{decision.action}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Confidence', value: `${decision.confidence}%`, icon: ShieldCheck, tone: 'text-green-400' },
            { label: 'Risk level', value: decision.riskLevel, icon: AlertTriangle, tone: decision.riskLevel === 'HIGH' ? 'text-amber-400' : 'text-cyan-300' },
            { label: 'Est. ROI', value: `${decision.roi >= 0 ? '+' : ''}${decision.roi.toFixed(2)}%`, icon: BarChart3, tone: decision.roi >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Current price', value: formatCurrency(decision.currentValue), icon: Wallet, tone: 'text-slate-200' },
            { label: 'Expiry', value: formatTime(proposal.expiresAt), icon: Clock, tone: 'text-slate-300' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-xl border border-white/5 bg-black/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.label}</p>
                  <Icon className={`h-4 w-4 ${item.tone}`} />
                </div>
                <p className={`mt-3 text-sm font-bold ${item.tone}`}>{item.value}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-6">
          <TheLogic reason={proposal.reason || []} rationaleSummary={proposal.summary || ''} confidence={decision.confidence} />

          <TheNumbers
            currentValue={decision.currentValue}
            projectedValue={decision.projectedValue}
            percentChange={proposal.financialImpact?.percentChange || 0}
            roi={decision.roi}
            tokenSymbol={decision.tokenSymbol}
          />

          <TheEvidence signalData={signal} tokenSymbol={decision.tokenSymbol} overrideSources={proposal.sources || signal?.sources} />
        </div>

        <aside className="space-y-6 xl:sticky xl:top-28 self-start">
          <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Action Readiness</h2>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Wallet connected', ok: connected, detail: connected ? 'Ready' : 'Connect wallet first' },
                { label: 'Executable proposal', ok: !decision.isSignalOnly, detail: decision.isSignalOnly ? 'Signal-only fallback' : 'Proposal found' },
                { label: 'Actionable signal', ok: decision.action !== 'HOLD', detail: decision.action === 'HOLD' ? 'Observation only' : decision.action },
                { label: 'Price available', ok: decision.currentValue > 0, detail: decision.currentValue > 0 ? formatCurrency(decision.currentValue) : 'Missing price' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/40 p-3">
                  <span className="text-sm text-slate-300">{item.label}</span>
                  <span className={`text-xs font-bold ${item.ok ? 'text-green-400' : 'text-amber-300'}`}>{item.detail}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Zap className={`h-5 w-5 ${actionConfig.text}`} />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Simulate / Execute</h2>
            </div>

            {decision.canExecute ? (
              <RiskSimulation
                currentPrice={decision.currentValue}
                targetPrice={decision.projectedValue}
                stopLoss={0}
                recommendation={decision.action}
                roi={decision.roi}
                tokenSymbol={decision.tokenSymbol}
                proposalId={proposal._id}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-5">
                <p className="text-sm text-slate-300">
                  Execution is disabled until this setup has a connected wallet, executable proposal, actionable BUY/SELL
                  recommendation, and available price.
                </p>
                <button
                  onClick={() => router.push(`/tokens/${decision.tokenSymbol}`)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
                >
                  Review Token <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>

      <SignalQualityComparison
        action={decision.action}
        confidence={decision.confidence}
        currentSignalId={proposal.signalId || proposal.triggerSignalId || proposal.triggerEventId || proposal._id}
        tokenSymbol={decision.tokenSymbol}
      />
    </div>
  );
}
