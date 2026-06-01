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
  ExternalLink,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
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
import { useSignalAnalytics } from '@/lib/hooks/useSignalAnalytics';
import { useAuth } from '@/app/contexts/AuthContext';
import { findDemoProposal } from '@/lib/demo/mockScenario';
import { useTradingDemoStore } from '@/app/contexts/TradingDemoContext';

import { RiskSimulation } from './RiskSimulation';

type ProposalDetailData = {
  _id: string;
  actualPnL?: number;
  action?: string;
  backtestMeta?: {
    dataQuality?: string;
    expiresAt?: string | Date;
    feeRate?: number;
    grossPnlPercentage?: number;
    exitTimestamp?: string | Date;
    entryTimestamp?: string | Date;
    notionalUsd?: number;
    slippageRate?: number;
  };
  backtestedAt?: string | Date;
  confidence?: number;
  entryPrice?: number;
  expiresAt?: string | Date;
  exitPrice?: number;
  financialImpact?: {
    currentValue?: number;
    projectedValue?: number;
    percentChange?: number;
    riskLevel?: string;
    roi?: number;
  };
  createdAt?: string | Date;
  pnlPercentage?: number;
  quantScore?: number;
  scoreComponents?: {
    btcTimeZ?: number;
    crossMean?: number;
    crossStd?: number;
    crossZ?: number;
    finalScore?: number;
    pureAlphaZ?: number;
    timeZ?: number;
    unifiedRaw?: number;
  };
  volatilityFlag?: number | null;
  reason?: string[];
  semantics?: {
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
    layerConflict?: {
      hasConflict: boolean;
      label: string;
      layer2Action: 'BUY' | 'SELL' | 'HOLD';
      layer3Action: 'BUY' | 'SELL' | 'HOLD';
      severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';
    };
    rationaleBadges?: Array<{ code: string; label: string; severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' }>;
    signalHealth?: {
      badges: Array<{ code: string; label: string; severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' }>;
      code: string;
      label: string;
      severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';
      shouldDim: boolean;
    };
    volatility?: {
      label: string;
      level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
      severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';
      value: number | null;
    };
  };
  signalId?: string;
  sentimentType?: string;
  signalContext?: {
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    quantScore?: number;
    scoreComponents?: {
      btcTimeZ?: number;
      crossMean?: number;
      crossStd?: number;
      crossZ?: number;
      finalScore?: number;
      pureAlphaZ?: number;
      timeZ?: number;
      unifiedRaw?: number;
    };
    status?: string;
    suggestionType?: string;
    expiresAt?: string | Date;
    volatilityFlag?: number | null;
    uncertaintyEntropy?: number | null;
    realizedVolatility?: number | null;
  };
  sources?: Array<{ label?: string; url?: string }>;
  status?: string;
  summary?: string;
  title?: string;
  tokenSymbol?: string;
  triggerEventId?: string;
  triggerSignalId?: string;
};

type SignalDetailData = {
  expiresAt?: string | Date;
  sources?: Array<{ label?: string; url?: string }>;
  sentimentType?: string;
  rationaleSummary?: string;
};

interface ProposalDetailSocialProps {
  onBack?: () => void;
}

type DecisionModel = {
  action: string;
  canExecute: boolean;
  confidence: number;
  currentValue: number;
  isSignalOnly: boolean;
  projectedValue: number;
  riskLevel: string;
  roi: number;
  tokenSymbol: string;
};

type RiskSizingModel = {
  accountValueUsd: number;
  maxLossUsd: number;
  recommendedSizeUsd: number;
  riskPerTradePct: number;
  stopLossPct: number;
};

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

function resolveExpiry(proposal: ProposalDetailData) {
  return proposal.expiresAt ?? proposal.signalContext?.expiresAt ?? proposal.backtestMeta?.expiresAt;
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value) || value === 0) return 'Unavailable';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 2 : 6,
  }).format(value);
}

function formatPct(value?: number | null) {
  if (!Number.isFinite(value)) return 'n/a';
  return `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`;
}

function formatScore(value?: number | null) {
  if (!Number.isFinite(value)) return 'n/a';
  return Number(value).toFixed(2);
}

function sourceLabel(source: { label?: string; url?: string }, index: number) {
  if (source.label) return source.label;
  if (!source.url) return `Source ${index + 1}`;

  try {
    return new URL(source.url).hostname.replace(/^www\./, '');
  } catch {
    return source.url;
  }
}

function severityClass(severity?: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH') {
  if (severity === 'HIGH') return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (severity === 'MEDIUM') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  if (severity === 'LOW') return 'border-green-500/30 bg-green-500/10 text-green-300';
  return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
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

function normalizeRiskLevel(value?: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  const upper = value?.toUpperCase();
  if (upper === 'LOW' || upper === 'MEDIUM' || upper === 'HIGH') return upper;
  return 'MEDIUM';
}

function getDemoProposalDetail(id: string): ProposalDetailData | null {
  const demo = findDemoProposal(id);
  if (!demo) return null;

  return {
    _id: demo._id,
    action: demo.action,
    confidence: demo.confidence,
    createdAt: demo.createdAt,
    expiresAt: demo.expiresAt,
    financialImpact: {
      currentValue: demo.financialImpact.currentValue,
      projectedValue: demo.financialImpact.projectedValue,
      percentChange: demo.financialImpact.percentChange,
      riskLevel: demo.financialImpact.riskLevel,
      roi: demo.financialImpact.roi,
    },
    quantScore: demo.action === 'SELL' ? -1.64 : demo.action === 'HOLD' ? 1.08 : 2.34,
    reason: demo.reason,
    semantics: {
      backtest: {
        actualPnlUsd: demo.action === 'SELL' ? -86.2 : demo.action === 'HOLD' ? null : 214.5,
        dataQuality: 'SIMULATED_CACHE',
        feePct: 0.06,
        grossPnlPct: demo.financialImpact.roi ?? null,
        label: 'Unified demo scenario',
        netPnlPct: demo.financialImpact.roi ?? null,
        outcome: demo.action === 'SELL' ? 'LOSS' : demo.action === 'HOLD' ? 'NOT_TESTED' : 'WIN',
        severity: normalizeRiskLevel(demo.financialImpact.riskLevel),
        slippagePct: 0.08,
      },
      layerConflict: {
        hasConflict: demo.action === 'SELL',
        label: demo.action === 'SELL' ? 'Risk-off disagreement' : 'Aligned',
        layer2Action: demo.action,
        layer3Action: demo.action === 'SELL' ? 'HOLD' : demo.action,
        severity: demo.action === 'SELL' ? 'HIGH' : 'LOW',
      },
      rationaleBadges: [],
      signalHealth: {
        badges: [],
        code: 'DEMO_MODE',
        label: 'Using cached simulation data',
        severity: 'INFO',
        shouldDim: false,
      },
      volatility: {
        label: demo.action === 'SELL' ? 'High volatility' : 'Modeled volatility',
        level: demo.action === 'SELL' ? 'HIGH' : 'MEDIUM',
        severity: demo.action === 'SELL' ? 'HIGH' : 'INFO',
        value: demo.action === 'SELL' ? 0.91 : 0.74,
      },
    },
    signalContext: {
      action: demo.action,
      confidence: demo.confidence,
      quantScore: demo.action === 'SELL' ? -1.64 : demo.action === 'HOLD' ? 1.08 : 2.34,
      scoreComponents: demo.action === 'SELL'
        ? { crossZ: -1.45, finalScore: -1.64, pureAlphaZ: -1.2, timeZ: -1.78, unifiedRaw: -1.5 }
        : { crossZ: 1.91, finalScore: 2.34, pureAlphaZ: 2.18, timeZ: 1.47, unifiedRaw: 2.02 },
      status: demo.status,
      suggestionType: demo.action.toLowerCase(),
      volatilityFlag: demo.action === 'SELL' ? 0.91 : 0.74,
    },
    sources: demo.sources?.map((url) => ({ label: 'Demo source', url })) || [],
    status: demo.status,
    summary: demo.summary,
    title: demo.title,
    tokenSymbol: demo.tokenSymbol,
  };
}

function DecisionSummary({
  decision,
  proposal,
}: {
  decision: DecisionModel;
  proposal: ProposalDetailData;
}) {
  const hasConsistencyWarning = proposal.semantics?.layerConflict?.hasConflict;
  const backtest = proposal.semantics?.backtest;
  const backtestLoss = backtest?.outcome === 'LOSS';

  return (
    <section className="glass-card rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Data to decision</p>
          <h2 className="text-2xl font-bold text-white">
            {decision.tokenSymbol}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Tóm tắt nhanh để quyết định: sức mạnh tín hiệu, rủi ro, chất lượng dữ liệu và thực tế backtest.
          </p>
        </div>
        <span className={`rounded-md border px-3 py-1.5 text-xs font-bold ${
          backtestLoss || hasConsistencyWarning ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-green-500/30 bg-green-500/10 text-green-300'
        }`}>
          {backtestLoss ? 'Backtest cần kiểm chứng' : hasConsistencyWarning ? 'Consistency warning' : 'Proposal validation OK'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'Signal strength', value: Number(proposal.signalContext?.quantScore ?? proposal.quantScore ?? 0).toFixed(2) },
          { label: 'Backtest', value: backtest?.outcome && backtest.outcome !== 'NOT_TESTED' ? `${backtest.outcome} ${formatPct(backtest.netPnlPct)}` : 'Chưa có dữ liệu' },
          { label: 'Expires', value: formatTime(resolveExpiry(proposal)) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-white/5 bg-black/40 p-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.label}</p>
            <p className="mt-2 text-sm font-bold text-white">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BacktestReplayPanel({
  decision,
  proposal,
}: {
  decision: DecisionModel;
  proposal: ProposalDetailData;
}) {
  const backtest = proposal.semantics?.backtest;
  const gross = backtest?.grossPnlPct ?? proposal.backtestMeta?.grossPnlPercentage ?? null;
  const net = backtest?.netPnlPct ?? proposal.pnlPercentage ?? null;
  const fee = backtest?.feePct ?? proposal.backtestMeta?.feeRate ?? null;
  const slippage = backtest?.slippagePct ?? proposal.backtestMeta?.slippageRate ?? null;
  const outcome = backtest?.outcome && backtest.outcome !== 'NOT_TESTED' ? backtest.outcome : 'NOT TESTED';
  const isLoss = outcome === 'LOSS';

  const replayRows = [
    {
      label: 'Signal detected',
      value: `${decision.action} ${decision.tokenSymbol}`,
      detail: `Entry reference ${formatCurrency(decision.currentValue)}`,
    },
    {
      label: 'Rule replay',
      value: backtest?.label || 'Demo rule',
      detail: backtest?.dataQuality ? `Data quality: ${backtest.dataQuality}` : 'Không giả định đây là backtest định lượng chuyên sâu.',
    },
    {
      label: 'Replay result',
      value: `${outcome} ${formatPct(net)}`,
      detail: `Gross ${formatPct(gross)} | Fee ${formatPct(fee)} | Slippage ${formatPct(slippage)}`,
    },
  ];

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Backtest replay</p>
          <h2 className="text-xl font-bold text-white">Bằng chứng mô phỏng trước khi quyết định</h2>
          <p className="mt-2 text-sm text-slate-400">
            Replay này minh họa chất lượng tín hiệu theo rule demo. Nó giúp audit quyết định, không phải cam kết lợi nhuận.
          </p>
        </div>
        <span className={`rounded-md border px-3 py-1.5 text-xs font-bold ${
          isLoss ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
        }`}>
          {outcome}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        {replayRows.map((row, index) => (
          <div key={row.label} className="rounded-xl border border-white/5 bg-black/40 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan-500/10 text-xs font-black text-cyan-300">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{row.label}</p>
                <p className="mt-1 truncate text-sm font-bold text-white">{row.value}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">{row.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Net PnL', value: formatPct(net), tone: Number(net) >= 0 ? 'text-green-300' : 'text-red-300' },
          { label: 'Actual PnL', value: backtest?.actualPnlUsd !== null && backtest?.actualPnlUsd !== undefined ? formatCurrency(backtest.actualPnlUsd) : formatCurrency(proposal.actualPnL || 0), tone: 'text-slate-200' },
          { label: 'Entry / Exit', value: `${formatCurrency(proposal.entryPrice || decision.currentValue)} -> ${formatCurrency(proposal.exitPrice || decision.projectedValue)}`, tone: 'text-cyan-300' },
          { label: 'Backtested at', value: formatTime(proposal.backtestedAt), tone: 'text-slate-300' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-white/5 bg-black/30 p-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.label}</p>
            <p className={`mt-2 text-sm font-bold ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProposalQuantDetails({
  decision,
  proposal,
}: {
  decision: DecisionModel;
  proposal: ProposalDetailData;
}) {
  const scoreComponents = proposal.signalContext?.scoreComponents;
  const componentRows = [
    { label: 'Unified raw', value: scoreComponents?.unifiedRaw },
    { label: 'Time Z', value: scoreComponents?.timeZ },
    { label: 'Pure alpha Z', value: scoreComponents?.pureAlphaZ },
    { label: 'Cross Z', value: scoreComponents?.crossZ },
    { label: 'Final score', value: scoreComponents?.finalScore },
    { label: 'Sentiment uncertainty', value: proposal.signalContext?.uncertaintyEntropy ?? proposal.signalContext?.volatilityFlag },
  ].filter((item) => Number.isFinite(item.value));

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Quant detail</p>
      <h2 className="text-xl font-bold text-white">Layer 2 đang nói gì?</h2>
      <p className="mt-2 text-sm text-slate-400">
        Đây là phần định lượng làm nền cho proposal. Layer 3 dùng dữ liệu này để diễn giải, không tự tạo tín hiệu ngược lại.
      </p>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Quant action', value: proposal.signalContext?.action || decision.action },
          { label: 'Quant score', value: formatScore(proposal.signalContext?.quantScore ?? proposal.quantScore) },
          { label: 'Confidence', value: `${decision.confidence}%` },
          { label: 'Risk level', value: decision.riskLevel },
          { label: 'Current', value: formatCurrency(decision.currentValue) },
          { label: 'Target', value: formatCurrency(decision.projectedValue) },
          { label: 'Est. ROI', value: formatPct(decision.roi) },
          { label: 'Suggestion', value: proposal.signalContext?.suggestionType || 'n/a' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-white/5 bg-black/40 p-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.label}</p>
            <p className="mt-2 text-sm font-bold text-white">{item.value}</p>
          </div>
        ))}
      </div>

      {componentRows.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/5 bg-black/30 p-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Score components</p>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
            {componentRows.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/5 bg-black/30 px-3 py-2">
                <p className="text-[10px] text-slate-500">{item.label}</p>
                <p className="text-sm font-bold text-slate-200">{formatScore(item.value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ProposalAIExplanation({
  proposal,
  signal,
}: {
  proposal: ProposalDetailData;
  signal: SignalDetailData | null;
}) {
  const explanation = proposal.summary || signal?.rationaleSummary || 'Proposal này chưa có phần giải thích AI.';
  const reasons = Array.isArray(proposal.reason) ? proposal.reason.filter(Boolean) : [];

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">AI explanation</p>
      <h2 className="text-xl font-bold text-white">AI diễn giải proposal thế nào?</h2>
      <p className="mt-3 rounded-xl border border-white/5 bg-black/40 p-4 text-sm leading-relaxed text-slate-300">
        {explanation}
      </p>

      {reasons.length > 0 ? (
        <div className="mt-4 space-y-2">
          {reasons.map((reason, index) => (
            <div key={`${reason}-${index}`} className="flex gap-3 rounded-xl border border-white/5 bg-black/30 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-500/10 text-xs font-black text-cyan-300">
                {index + 1}
              </span>
              <p className="text-sm text-slate-300">{reason}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ProposalSources({ sources }: { sources: Array<{ label?: string; url?: string }> }) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Nguồn dữ liệu</p>
      <h2 className="text-xl font-bold text-white">Proposal lấy tín hiệu từ đâu?</h2>

      {sources.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {sources.map((source, index) => (
            source.url ? (
              <a
                key={`${source.url}-${index}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm font-bold text-cyan-200 transition-colors hover:bg-cyan-500/10"
              >
                <span className="min-w-0 truncate">{sourceLabel(source, index)}</span>
                <ExternalLink className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100" />
              </a>
            ) : (
              <div key={`${source.label}-${index}`} className="rounded-xl border border-white/5 bg-black/30 p-4 text-sm text-slate-400">
                {sourceLabel(source, index)}
              </div>
            )
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/30 p-4 text-sm text-slate-500">
          Proposal hiện chưa gắn nguồn cụ thể. Khi API trả về `sources`, các link sẽ hiển thị và click được tại đây.
        </p>
      )}
    </section>
  );
}

function ProposalHistoryChart({
  decision,
  proposal,
}: {
  decision: DecisionModel;
  proposal: ProposalDetailData;
}) {
  const { rows, loading } = useSignalAnalytics();
  const currentScore = Number(proposal.signalContext?.quantScore ?? proposal.quantScore ?? 0);

  const chartRows = useMemo(() => {
    const sameTokenRows = rows
      .filter((row) => row.tokenSymbol?.toUpperCase() === decision.tokenSymbol.toUpperCase())
      .filter((row) => row.id !== proposal.triggerSignalId && row.id !== proposal.signalId)
      .slice(0, 5)
      .reverse()
      .map((row, index) => ({
        label: `Past ${index + 1}`,
        confidence: normalizeConfidence(row.confidence),
        score: Number(row.signalScore.toFixed(2)),
      }));

    return [
      ...sameTokenRows,
      {
        label: 'Current',
        confidence: decision.confidence,
        score: Number(currentScore.toFixed(2)),
      },
    ];
  }, [currentScore, decision.confidence, decision.tokenSymbol, proposal.signalId, proposal.triggerSignalId, rows]);

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">History comparison</p>
      <h2 className="text-xl font-bold text-white">So với các tín hiệu trước đó</h2>
      <p className="mt-2 text-sm text-slate-400">
        So sánh quant score và confidence của proposal hiện tại với các tín hiệu cùng token trong lịch sử gần nhất.
      </p>

      {loading ? (
        <Skeleton className="mt-4 h-64 w-full bg-white/10" />
      ) : chartRows.length > 1 ? (
        <div className="mt-4 h-64 rounded-xl border border-white/5 bg-black/30 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#020617',
                  border: '1px solid rgba(34,211,238,0.2)',
                  borderRadius: 12,
                  color: '#e2e8f0',
                }}
              />
              <Bar dataKey="score" name="Quant score" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              <Bar dataKey="confidence" name="Confidence %" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/30 p-4 text-sm text-slate-500">
          Chưa có đủ tín hiệu cùng token để so sánh lịch sử. Proposal hiện tại vẫn được hiển thị ở phần Quant detail.
        </p>
      )}
    </section>
  );
}

function ProposalValidationSummary({
  blockers,
  proposal,
}: {
  blockers: Array<{ label: string; severity: 'warning' | 'danger' }>;
  proposal: ProposalDetailData;
}) {
  const backtest = proposal.semantics?.backtest;

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Kiểm chứng proposal</p>
      <h2 className="text-xl font-bold text-white">Có gì cần xem trước khi quyết định?</h2>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`rounded-xl border p-4 ${severityClass(backtest?.severity)}`}>
          <p className="text-[10px] uppercase tracking-widest font-bold">Backtest</p>
          <p className="mt-2 text-lg font-black">{backtest?.outcome && backtest.outcome !== 'NOT_TESTED' ? backtest.outcome : 'Chưa có'}</p>
          <p className="mt-1 text-xs opacity-80">Net PnL: {formatPct(backtest?.netPnlPct)}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/40 p-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Data quality</p>
          <p className="mt-2 text-lg font-black text-white">{backtest?.dataQuality || 'n/a'}</p>
          <p className="mt-1 text-xs text-slate-500">Chỉ là dữ liệu demo/proposal, chưa cá nhân hóa user.</p>
        </div>
        <div className={`rounded-xl border p-4 ${blockers.length ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>
          <p className="text-[10px] uppercase tracking-widest font-bold">Decision blockers</p>
          <p className="mt-2 text-lg font-black">{blockers.length}</p>
          <p className="mt-1 text-xs opacity-80">{blockers.length ? 'Nên đọc cảnh báo ở panel bên phải.' : 'Không có cảnh báo lớn.'}</p>
        </div>
      </div>
    </section>
  );
}

function RiskSizingPanel({
  sizing,
  onChange,
}: {
  sizing: RiskSizingModel;
  onChange: (next: Pick<RiskSizingModel, 'riskPerTradePct' | 'stopLossPct'>) => void;
}) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Risk sizing</p>
      <h2 className="text-xl font-bold text-white">Nên vào bao nhiêu?</h2>
      <p className="mt-2 text-sm text-slate-400">
        Size đề xuất dựa trên giá trị tài khoản, mức lỗ tối đa cho mỗi lệnh và stop-loss giả định.
      </p>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/5 bg-black/40 p-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Account value</p>
          <p className="mt-2 text-sm font-bold text-white">{formatCurrency(sizing.accountValueUsd)}</p>
        </div>
        <label className="rounded-xl border border-white/5 bg-black/40 p-4">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Risk / trade</span>
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={sizing.riskPerTradePct}
            onChange={(event) => onChange({ riskPerTradePct: Number(event.target.value), stopLossPct: sizing.stopLossPct })}
            className="mt-2 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-sm text-white outline-none focus:border-cyan-500/40"
          />
        </label>
        <label className="rounded-xl border border-white/5 bg-black/40 p-4">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Stop loss</span>
          <input
            type="number"
            min="0.5"
            max="50"
            step="0.5"
            value={sizing.stopLossPct}
            onChange={(event) => onChange({ riskPerTradePct: sizing.riskPerTradePct, stopLossPct: Number(event.target.value) })}
            className="mt-2 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-sm text-white outline-none focus:border-cyan-500/40"
          />
        </label>
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
          <p className="text-[10px] uppercase tracking-widest text-green-300 font-bold">Recommended size</p>
          <p className="mt-2 text-lg font-black text-green-200">{formatCurrency(sizing.recommendedSizeUsd)}</p>
          <p className="mt-1 text-xs text-green-300/70">Max loss {formatCurrency(sizing.maxLossUsd)}</p>
        </div>
      </div>
    </section>
  );
}

function DecisionPanel({
  actionText,
  blockers,
  canExecute,
  onEnter,
  onReject,
  onWait,
  pressure,
  executing,
}: {
  actionText: string;
  blockers: Array<{ label: string; severity: 'warning' | 'danger' }>;
  canExecute: boolean;
  executing: boolean;
  onEnter: () => void;
  onReject: () => void;
  onWait: () => void;
  pressure: boolean;
}) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-5 w-5 text-cyan-400" />
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Decision Panel</h2>
      </div>

      {blockers.length > 0 && (
        <div className="mb-4 space-y-2">
          {blockers.map((blocker) => (
            <div
              key={blocker.label}
              className={`flex items-start gap-2 rounded-xl border p-3 text-xs font-bold ${
                blocker.severity === 'danger'
                  ? 'border-red-500/30 bg-red-500/10 text-red-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {blocker.label}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        <button
          onClick={onEnter}
          disabled={executing}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
            canExecute && !pressure && !executing
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-900/20 hover:from-green-500 hover:to-emerald-500'
              : 'border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
          }`}
        >
          {executing ? 'PROCESSING DEMO...' : <>ENTER {actionText !== 'HOLD' ? actionText : ''} demo <ArrowRight className="h-4 w-4" /></>}
        </button>
        <button
          onClick={onWait}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
            pressure
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/20 hover:from-cyan-500 hover:to-blue-500'
              : 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15'
          }`}
        >
          WAIT / Watchlist <Clock className="h-4 w-4" />
        </button>
        <button
          onClick={onReject}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 hover:bg-red-500/15 transition-colors"
        >
          REJECT signal <XCircle className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function AuditTrailPreview({
  proposalId,
}: {
  proposalId: string;
}) {
  const { auditLogs, orders, proposalDecisions } = useTradingDemoStore();
  const proposalLogs = auditLogs.filter((log) => log.proposalId === proposalId).slice(0, 4);
  const proposalOrders = orders.filter((order) => order.proposalId === proposalId).slice(0, 2);
  const decisions = proposalDecisions.filter((decision) => decision.proposalId === proposalId).slice(0, 2);

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-cyan-400" />
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Audit Trail Preview</h2>
      </div>

      {proposalLogs.length === 0 && proposalOrders.length === 0 && decisions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-black/30 p-4 text-sm text-slate-500">
          No execution decision has been recorded yet. When demo execution runs, order and fill events appear here.
        </p>
      ) : (
        <div className="space-y-3">
          {decisions.map((decision) => (
            <div key={decision.id} className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-green-200">{decision.status.toUpperCase()}</p>
                <span className="text-[10px] text-slate-500">{formatTime(decision.createdAt)}</span>
              </div>
              {decision.reason && <p className="mt-1 text-[10px] text-slate-400">{decision.reason}</p>}
            </div>
          ))}
          {proposalOrders.map((order) => (
            <div key={order.id} className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-cyan-200">{order.action} {order.tokenSymbol}</p>
                <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                  {order.status}
                </span>
              </div>
              <p className="mt-1 text-[10px] font-mono text-slate-500">{order.id}</p>
            </div>
          ))}
          {proposalLogs.map((log) => (
            <div key={log.id} className="rounded-xl border border-white/5 bg-black/30 p-3">
              <p className="text-xs font-bold text-slate-200">{log.action}</p>
              <p className="mt-1 text-[10px] text-slate-500">{formatTime(log.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ProposalDetailSocial({ onBack }: ProposalDetailSocialProps) {
  const router = useRouter();
  const params = useParams();
  const { connected, publicKey } = useWallet();
  const { user } = useAuth();
  const { proposalDecisions, recordProposalDecision } = useTradingDemoStore();

  const [proposal, setProposal] = useState<ProposalDetailData | null>(null);
  const [signal, setSignal] = useState<SignalDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [executeNonce, setExecuteNonce] = useState(0);
  const [isExecutingDemo, setIsExecutingDemo] = useState(false);
  const [portfolioValue, setPortfolioValue] = useState<number | null>(null);
  const [riskInputs, setRiskInputs] = useState({ riskPerTradePct: 1, stopLossPct: 5 });

  useEffect(() => {
    async function fetchData() {
      if (!params?.id) return;
      setLoading(true);
      setFetchError(null);

      try {
        const propRes = await fetch(`/api/proposals/${params.id}`);
        if (!propRes.ok) {
          const demoProposal = getDemoProposalDetail(String(params.id));
          if (demoProposal) {
            setProposal(demoProposal);
            setSignal({
              rationaleSummary: demoProposal.summary,
              sources: demoProposal.sources,
              sentimentType: demoProposal.sentimentType,
            });
            return;
          }
          throw new Error('Proposal not found');
        }

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
        const demoProposal = getDemoProposalDetail(String(params.id));
        if (demoProposal) {
          setProposal(demoProposal);
          setSignal({
            rationaleSummary: demoProposal.summary,
            sources: demoProposal.sources,
            sentimentType: demoProposal.sentimentType,
          });
          setFetchError(null);
          toast.info('Backend unavailable, using cached simulation proposal.');
          return;
        }
        setFetchError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params.id]);

  useEffect(() => {
    async function fetchPortfolioValue() {
      if (!publicKey) {
        setPortfolioValue(null);
        return;
      }

      try {
        const res = await fetch(`/api/portfolio?wallet=${publicKey.toBase58()}`);
        if (!res.ok) return;
        const data = await res.json();
        setPortfolioValue(Number(data.stats?.totalValue || 0));
      } catch {
        setPortfolioValue(null);
      }
    }

    fetchPortfolioValue();
  }, [publicKey]);

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
    const canExecute = action !== 'HOLD' && !isSignalOnly && currentValue > 0;
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

  const blockers = useMemo(() => {
    if (!proposal || !decision) return [];

    const items: Array<{ label: string; severity: 'warning' | 'danger' }> = [];
    const isExpired = proposal.expiresAt ? new Date(proposal.expiresAt).getTime() < Date.now() : false;

    if (!connected) {
      items.push({
        label: 'Chưa connect wallet: vẫn chạy local demo, nhưng backend sync và wallet audit sẽ bị bỏ qua.',
        severity: 'warning',
      });
    }
    if (proposal.semantics?.layerConflict?.hasConflict) {
      items.push({
        label: 'Có cảnh báo consistency trong proposal metadata, cần kiểm chứng cách Layer 3 diễn giải tín hiệu Layer 2.',
        severity: 'warning',
      });
    }
    if (proposal.semantics?.backtest?.outcome === 'LOSS') {
      items.push({ label: `Backtest đang lỗ ${formatPct(proposal.semantics.backtest.netPnlPct)}.`, severity: 'danger' });
    }
    if (isExpired) items.push({ label: 'Proposal đã hết hạn, cần đánh giá lại tín hiệu trước khi vào lệnh.', severity: 'warning' });
    if (decision.currentValue <= 0) items.push({ label: 'Thiếu dữ liệu giá hiện tại.', severity: 'warning' });
    if (decision.isSignalOnly) items.push({ label: 'Đây là signal-only fallback, chưa phải proposal executable đầy đủ.', severity: 'warning' });
    if (decision.action === 'HOLD') items.push({ label: 'Tín hiệu hiện tại là HOLD, ưu tiên chờ thêm.', severity: 'warning' });

    return items;
  }, [connected, decision, proposal]);

  const riskSizing = useMemo<RiskSizingModel | null>(() => {
    if (!decision) return null;
    const accountValueUsd = Math.max(
      Number(portfolioValue || 0),
      Number(user?.totalAssetUsd || 0),
      Number(user?.cryptoInvestmentUsd || 0),
      decision.currentValue > 0 ? decision.currentValue * 5 : 0,
      1000
    );
    const riskPerTradePct = Math.min(Math.max(riskInputs.riskPerTradePct, 0.1), 10);
    const stopLossPct = Math.min(Math.max(riskInputs.stopLossPct, 0.5), 50);
    const maxLossUsd = accountValueUsd * (riskPerTradePct / 100);
    const rawSize = maxLossUsd / (stopLossPct / 100);
    const recommendedSizeUsd = Math.min(rawSize, accountValueUsd);

    return {
      accountValueUsd,
      maxLossUsd,
      recommendedSizeUsd: Math.max(50, Math.round(recommendedSizeUsd / 50) * 50),
      riskPerTradePct,
      stopLossPct,
    };
  }, [decision, portfolioValue, riskInputs.riskPerTradePct, riskInputs.stopLossPct, user?.cryptoInvestmentUsd, user?.totalAssetUsd]);

  const currentDecision = useMemo(() => {
    if (!proposal?._id) return null;
    return proposalDecisions.find((item) => item.proposalId === proposal._id) || null;
  }, [proposal?._id, proposalDecisions]);

  const persistDecision = async (decisionType: 'WAIT' | 'REJECT') => {
    if (!proposal || !decision) return;

    recordProposalDecision({
      blockers,
      proposalId: proposal._id,
      reason: decisionType === 'WAIT'
        ? 'User moved the proposal to watchlist for more confirmation.'
        : 'User rejected the proposal after reviewing risk evidence.',
      snapshot: {
        action: decision.action,
        confidence: decision.confidence,
        quantScore: proposal.signalContext?.quantScore ?? proposal.quantScore,
        riskLevel: decision.riskLevel,
        roi: decision.roi,
      },
      status: decisionType === 'WAIT' ? 'watching' : 'rejected',
      tokenSymbol: decision.tokenSymbol,
    });

    try {
      await fetch(`/api/proposals/${proposal._id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: decisionType,
          walletAddress: user?.walletAddress,
          userId: user?._id,
          blockers,
          snapshot: {
            action: decision.action,
            confidence: decision.confidence,
            quantScore: proposal.signalContext?.quantScore ?? proposal.quantScore,
            riskLevel: decision.riskLevel,
            roi: decision.roi,
            riskSizing,
          },
        }),
      });
    } catch {
      toast.info('Backend decision sync unavailable; local audit trail is still saved for demo.');
    }
  };

  const hasDecisionPressure = blockers.some((blocker) => blocker.severity === 'danger');

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-24">
        <div className="flex min-h-[16vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
        <Skeleton className="h-40 w-full bg-white/10" />
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <Skeleton className="h-96 w-full bg-white/10" />
          <Skeleton className="h-80 w-full bg-white/10" />
        </div>
      </div>
    );
  }

  if (fetchError || !proposal || !decision) {
    return (
      <div className="glass-card rounded-xl border border-red-500/30 p-10 text-center text-red-300">
        <p>{fetchError || 'Proposal not found.'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/15 transition-colors"
        >
          Thử lại
        </button>
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
          {currentDecision?.status ? currentDecision.status.toUpperCase() : (proposal.status || 'ACTIVE').toUpperCase()}
        </span>
      </div>

      <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Decision Cockpit</p>
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-purple-cyan shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                <span className="text-xl font-black text-white">{decision.tokenSymbol.slice(0, 2)}</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-bold gradient-text md:text-4xl">
                  {decision.tokenSymbol}
                </h1>
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

        {(proposal.semantics?.layerConflict?.hasConflict || proposal.semantics?.signalHealth || proposal.semantics?.rationaleBadges?.length) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {proposal.semantics.layerConflict?.hasConflict && (
              <span className={`rounded-md border px-3 py-1.5 text-xs font-bold ${severityClass(proposal.semantics.layerConflict.severity)}`}>
                Consistency warning: kiểm chứng diễn giải proposal
              </span>
            )}
            {proposal.semantics.signalHealth?.badges.map((badge) => (
              <span key={badge.code} className={`rounded-md border px-3 py-1.5 text-xs font-bold ${severityClass(badge.severity)}`}>
                {badge.label}
              </span>
            ))}
            {proposal.semantics.rationaleBadges?.map((badge) => (
              <span key={badge.code} className={`rounded-md border px-3 py-1.5 text-xs font-bold ${severityClass(badge.severity)}`}>
                {badge.label}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Confidence', value: `${decision.confidence}%`, icon: ShieldCheck, tone: 'text-green-400' },
            { label: 'Risk level', value: decision.riskLevel, icon: AlertTriangle, tone: decision.riskLevel === 'HIGH' ? 'text-amber-400' : 'text-cyan-300' },
            { label: 'Est. ROI', value: `${decision.roi >= 0 ? '+' : ''}${decision.roi.toFixed(2)}%`, icon: BarChart3, tone: decision.roi >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Current price', value: formatCurrency(decision.currentValue), icon: Wallet, tone: 'text-slate-200' },
            { label: 'Expiry', value: formatTime(resolveExpiry(proposal)), icon: Clock, tone: 'text-slate-300' },
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

      <DecisionSummary decision={decision} proposal={proposal} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-6">
          <ProposalAIExplanation proposal={proposal} signal={signal} />
          <ProposalQuantDetails decision={decision} proposal={proposal} />
          <BacktestReplayPanel decision={decision} proposal={proposal} />
          <ProposalHistoryChart decision={decision} proposal={proposal} />
          <ProposalSources sources={proposal.sources?.length ? proposal.sources : signal?.sources || []} />
          <ProposalValidationSummary blockers={blockers} proposal={proposal} />
          {riskSizing && (
          <RiskSizingPanel
            sizing={riskSizing}
            onChange={(next) => setRiskInputs({
              riskPerTradePct: Number.isFinite(next.riskPerTradePct) ? next.riskPerTradePct : riskInputs.riskPerTradePct,
              stopLossPct: Number.isFinite(next.stopLossPct) ? next.stopLossPct : riskInputs.stopLossPct,
            })}
          />
          )}
        </div>

        <aside className="space-y-6 xl:sticky xl:top-28 self-start">
          <DecisionPanel
            actionText={decision.action}
            blockers={blockers}
            canExecute={decision.canExecute}
            executing={isExecutingDemo}
            pressure={hasDecisionPressure}
            onEnter={() => {
              if (currentDecision?.status === 'executed') {
                toast.info('Proposal already has an open demo execution. Opening positions workspace.');
                router.push('/positions');
                return;
              }
              if (decision.canExecute && !isExecutingDemo) {
                setExecuteNonce((value) => value + 1);
              } else {
                toast.warning('Cần xử lý blocker trước khi vào lệnh.');
              }
            }}
            onWait={() => {
              (async () => {
                try {
                  await persistDecision('WAIT');
                  toast.info('Đã lưu quyết định chờ thêm và chuyển về danh sách tín hiệu.');
                  router.push('/signals');
                } catch {
                  toast.error('Không lưu được quyết định chờ thêm.');
                }
              })();
            }}
            onReject={() => {
              (async () => {
                try {
                  await persistDecision('REJECT');
                  toast.info('Đã lưu quyết định bỏ qua proposal này.');
                  router.push('/signals');
                } catch {
                  toast.error('Không lưu được quyết định bỏ qua.');
                }
              })();
            }}
          />

          <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Zap className={`h-5 w-5 ${actionConfig.text}`} />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Simulate / Vào lệnh</h2>
            </div>

            {decision.canExecute ? (
                <RiskSimulation
                  currentPrice={decision.currentValue}
                  targetPrice={decision.projectedValue}
                  stopLoss={0}
                  recommendation={decision.action}
                  roi={decision.roi}
                  initialAmount={riskSizing?.recommendedSizeUsd}
                  maxAmount={riskSizing?.accountValueUsd}
                  maxLossUsd={riskSizing?.maxLossUsd}
                  riskPerTradePct={riskSizing?.riskPerTradePct}
                  stopLossPct={riskSizing?.stopLossPct}
                  tokenSymbol={decision.tokenSymbol}
                  proposalId={proposal._id}
                  executeNonce={executeNonce}
                  confidence={decision.confidence}
                  quantScore={proposal.signalContext?.quantScore ?? proposal.quantScore}
                  riskLevel={decision.riskLevel}
                  onExecutingChange={setIsExecutingDemo}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-5">
                <p className="text-sm text-slate-300">
                  Execution is disabled until this setup has an executable proposal, actionable BUY/SELL
                  recommendation, and available price. Wallet connection only controls backend sync; local demo execution can run without it.
                </p>
                <button
                  onClick={() => router.push(`/tokens/${decision.tokenSymbol}`)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
                >
                  Đánh giá lệnh <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>

          <AuditTrailPreview proposalId={proposal._id} />
        </aside>
      </div>

    </div>
  );
}
