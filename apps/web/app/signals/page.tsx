'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Flame,
  Grid3X3,
  ListFilter,
  RefreshCw,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { SignalHeatmap } from '@/app/components/analytics/SignalHeatmap';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { useSignalAnalytics } from '@/lib/hooks/useSignalAnalytics';
import type { AnalyticsAction, SignalAnalyticsRow } from '@/lib/types/analytics';
import { decisionStateMeta, getDecisionState } from '@/app/components/analytics/decisionState';

type ActionFilter = 'ALL' | AnalyticsAction;
type DecisionFilter = 'ALL' | 'ready' | 'conflict' | 'risk' | 'wait';
type SortKey = 'rank' | 'signalScore' | 'confidence' | 'detectedAt' | 'expiresAt';

function actionTone(action: AnalyticsAction) {
  if (action === 'BUY') return 'bg-green-500/10 text-green-300 border-green-500/20';
  if (action === 'SELL') return 'bg-red-500/10 text-red-300 border-red-500/20';
  return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
}

function scoreTone(value: number) {
  if (value > 0) return 'text-green-300';
  if (value < 0) return 'text-red-300';
  return 'text-slate-300';
}

function backtestTone(outcome?: string) {
  if (outcome === 'WIN') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (outcome === 'LOSS') return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (outcome === 'BREAKEVEN') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
  return 'border-white/10 bg-black/40 text-slate-500';
}

function riskTone(row: SignalAnalyticsRow) {
  if (row.semantics?.health.severity === 'HIGH') return 'text-red-300';
  if (row.divergence !== 'None') return 'text-amber-300';
  if (row.action === 'SELL') return 'text-red-300';
  return 'text-slate-500';
}

function lifecycleTone(state?: SignalAnalyticsRow['lifecycleState']) {
  if (state === 'BACKTESTED') return 'border-green-500/25 bg-green-500/10 text-green-300';
  if (state === 'EXPLAINED') return 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300';
  if (state === 'EXPLANATION_PENDING') return 'border-amber-500/25 bg-amber-500/10 text-amber-300';
  return 'border-purple-500/25 bg-purple-500/10 text-purple-300';
}

function lifecycleLabel(state?: SignalAnalyticsRow['lifecycleState']) {
  if (state === 'BACKTESTED') return 'Backtested';
  if (state === 'EXPLAINED') return 'AI explained';
  if (state === 'EXPLANATION_PENDING') return 'AI pending';
  return 'Quant ready';
}

function formatDate(value?: string) {
  if (!value) return 'n/a';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

// Thêm hàm helper này ở ngay trên component FeedSignalCard để tách câu đầu tiên
function getCoreRationale(text?: string) {
  if (!text) return 'Không có dữ liệu lý do.';
  // Cắt text đến dấu chấm/chấm hỏi/chấm than đầu tiên
  const match = text.match(/.*?[.!?](?:\s|$)/);
  return match ? match[0].trim() : text;
}

function FeedSignalCard({
  row,
  onOpen,
  onOpenToken,
}: {
  // Lưu ý: Cần đảm bảo interface SignalAnalyticsRow trong analytics.ts đã được thêm trường `status?: string;`
  row: SignalAnalyticsRow & { status?: string }; 
  onOpen: (id: string) => void;
  onOpenToken: (symbol: string) => void;
}) {
  const isFailed = row.semantics?.health.shouldDim || row.status === 'FAILED';
  const coreRationale = getCoreRationale(row.rationaleSummary);
  const healthLabel = row.semantics?.health.label || (isFailed ? 'Pipeline status failed' : 'Signal health OK');
  const healthSeverity = row.semantics?.health.severity || (isFailed ? 'HIGH' : 'LOW');
  const decisionState = decisionStateMeta(getDecisionState(row));

  return (
    <article 
      className={`glass-card rounded-xl border p-5 relative transition-all duration-300 ${
        isFailed 
          ? 'border-red-500/30 bg-red-950/20 opacity-80 grayscale-[30%]' 
          : 'border-white/5 bg-black/20 hover:border-cyan-500/30 hover:bg-white/[0.02]'
      }`}
    >
      {/* Cảnh báo FAILED SIGNAL góc phải trên cùng */}
      {isFailed && (
        <div className="absolute top-0 right-0 bg-red-500/20 text-red-400 text-[10px] font-bold px-3 py-1.5 rounded-bl-xl border-b border-l border-red-500/30 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" /> {healthLabel}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-white">{row.tokenSymbol}</span>
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${actionTone(row.action)}`}>
              {row.action}
            </span>
            <span className="text-[10px] text-slate-500">Rank #{row.rank}</span>
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${decisionState.className}`}>
              {decisionState.label}
            </span>
            {!isFailed && (
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                healthSeverity === 'LOW' ? 'border-green-500/20 bg-green-500/10 text-green-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
              }`}>
                {healthLabel}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${lifecycleTone(row.lifecycleState)}`}>
              {lifecycleLabel(row.lifecycleState)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 truncate">{row.tokenName || 'Native Token'}</p>
        </div>
        
        {/* Khối điểm số to, rõ ràng */}
        <div className="shrink-0 text-right mt-1">
          <p className={`font-mono text-xl font-black ${scoreTone(row.signalScore)}`}>
            {formatScore(row.signalScore)}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Quant score</p>
        </div>
      </div>

      {/* Hiển thị câu đầu tiên của LLM thay vì cả cụm dài */}
      <div className="mt-4 flex items-start gap-2">
        <Flame className={`w-4 h-4 shrink-0 mt-0.5 ${isFailed ? 'text-red-500/50' : 'text-amber-500'}`} />
        <p className={`text-sm font-medium ${isFailed ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
          {coreRationale}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {row.layerConflict?.hasConflict && (
          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300">
            Consistency warning
          </span>
        )}
        {row.backtest && row.backtest.outcome !== 'NOT_TESTED' && (
          <span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${backtestTone(row.backtest.outcome)}`}>
            Backtest {row.backtest.outcome} {row.backtest.netPnlPct !== null ? `(${row.backtest.netPnlPct.toFixed(2)}%)` : ''}
          </span>
        )}
        {row.rationaleBadges?.map((badge) => (
          <span key={badge.code} className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300">
            {badge.label}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Tin cậy</p>
          <p className={`mt-1 font-mono ${isFailed ? 'text-slate-500' : 'text-green-300'}`}>
            {row.confidence}%
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Time-Z</p>
          <p className={`mt-1 font-mono ${isFailed ? 'text-slate-500' : scoreTone(row.zScore ?? 0)}`}>
            {formatScore(row.zScore)}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Nguồn</p>
          <p className={`mt-1 font-mono ${isFailed ? 'text-slate-500' : 'text-cyan-300'}`}>
            {row.sources?.length || 0}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Hết hạn</p>
          <p className="mt-1 text-xs text-slate-400">{formatDate(row.expiresAt)}</p>
        </div>
      </div>

      {row.confidenceBreakdown?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {row.confidenceBreakdown.slice(0, 4).map((item) => (
            <span
              key={item.label}
              className={`rounded-md border px-2 py-1 text-[10px] font-bold ${
                item.impact === 'positive'
                  ? 'border-green-500/20 bg-green-500/10 text-green-300'
                  : item.impact === 'negative'
                    ? 'border-red-500/20 bg-red-500/10 text-red-300'
                    : 'border-white/10 bg-black/40 text-slate-400'
              }`}
            >
              {item.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className={`text-xs font-medium ${riskTone(row)}`}>
          {isFailed ? `⚠️ ${healthLabel}` : row.divergence !== 'None' ? `⚠️ ${row.divergence}` : '✓ Không có rủi ro bất thường'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onOpenToken(row.tokenSymbol)}
            className="glass-card rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Mã Token
          </button>
          
          <button
            onClick={() => onOpen(row.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              isFailed 
                ? 'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15' 
                : 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500'
            }`}
          >
            {isFailed ? 'Quản lý rủi ro' : 'Xem tín hiệu'} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </article>
  );
}
export default function SignalsPage() {
  const router = useRouter();
  const { demoReason, isDemoMode, lastUpdatedAt, rows, summary, loading, error, refetch } = useSignalAnalytics();
  const [refreshing, setRefreshing] = useState(false);
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL');
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>(() => {
    const value = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('decision') : null;
    return value === 'ready' || value === 'conflict' || value === 'risk' || value === 'wait' ? value : 'ALL';
  });
  const [riskOnly, setRiskOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('signalScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => actionFilter === 'ALL' || row.action === actionFilter)
      .filter((row) => decisionFilter === 'ALL' || getDecisionState(row) === decisionFilter)
      .filter((row) => !riskOnly || row.divergence !== 'None' || row.action === 'SELL')
      .sort((a, b) => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        if (sortKey === 'detectedAt' || sortKey === 'expiresAt') {
          return (new Date(a[sortKey] || 0).getTime() - new Date(b[sortKey] || 0).getTime()) * direction;
        }
        return (Number(a[sortKey] ?? 0) - Number(b[sortKey] ?? 0)) * direction;
      });
  }, [actionFilter, decisionFilter, riskOnly, rows, sortDirection, sortKey]);

  const groupedRows = useMemo(() => {
    const groups = {
      ready: filteredRows.filter((row) => getDecisionState(row) === 'ready'),
      validation: filteredRows.filter((row) => getDecisionState(row) === 'conflict'),
      riskWait: filteredRows.filter((row) => {
        const state = getDecisionState(row);
        return state === 'risk' || state === 'wait';
      }),
    };

    return [
      { key: 'ready', label: 'Ready', rows: groups.ready },
      { key: 'validation', label: 'Validation Check', rows: groups.validation },
      { key: 'riskWait', label: 'Risk / Wait', rows: groups.riskWait },
    ];
  }, [filteredRows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('desc');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-bold mb-2">Signal Feed</p>
            <h1 className="text-4xl font-bold gradient-text">Signals</h1>
            <p className="text-slate-400 mt-2 max-w-2xl">
              Scan opportunities by action, confidence, quant score, anomaly risk, and expiry before opening the decision page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-200 hover:bg-cyan-500/15 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => router.push('/signals/daily')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
            >
              Open Alpha Monitor <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isDemoMode && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Demo mode active: signal feed is using cached scenario data{demoReason ? ` (${demoReason})` : ''}. Last refresh{' '}
            {lastUpdatedAt ? formatDate(lastUpdatedAt) : 'n/a'}.
          </div>
        )}

        {error ? (
          <div className="glass-card rounded-xl p-8 border border-red-500/30 text-red-300">
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/15 transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="glass-card rounded-xl border border-white/5 bg-black/20 p-5 space-y-4">
                <Skeleton className="h-5 w-40 bg-white/10" />
                <Skeleton className="h-16 w-full bg-white/10" />
                <div className="grid grid-cols-4 gap-3">
                  <Skeleton className="h-14 bg-white/10" />
                  <Skeleton className="h-14 bg-white/10" />
                  <Skeleton className="h-14 bg-white/10" />
                  <Skeleton className="h-14 bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Total', value: summary.totalSignals, icon: BarChart3, tone: 'text-cyan-400' },
                { label: 'Buy', value: summary.buyCount, icon: ArrowUp, tone: 'text-green-400' },
                { label: 'Sell', value: summary.sellCount, icon: ArrowDown, tone: 'text-red-400' },
                { label: 'Hold', value: summary.holdCount, icon: ShieldCheck, tone: 'text-purple-400' },
                { label: 'Anomalies', value: summary.anomalyCount, icon: AlertTriangle, tone: summary.anomalyCount ? 'text-amber-400' : 'text-slate-400' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="glass-card rounded-xl border border-white/5 bg-black/40 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.label}</p>
                      <Icon className={`w-4 h-4 ${item.tone}`} />
                    </div>
                    <p className={`mt-3 text-2xl font-bold ${item.tone}`}>{item.value}</p>
                  </div>
                );
              })}
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-slate-300">
                  <ListFilter className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold">Filters</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(['ALL', 'BUY', 'SELL', 'HOLD'] as ActionFilter[]).map((action) => (
                    <button
                      key={action}
                      onClick={() => setActionFilter(action)}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                        actionFilter === action
                          ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                          : 'border-white/10 bg-black/40 text-slate-400 hover:text-white'
                      }`}
                    >
                      {action}
                    </button>
                  ))}
                  <button
                    onClick={() => setRiskOnly((value) => !value)}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      riskOnly
                        ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                        : 'border-white/10 bg-black/40 text-slate-400 hover:text-white'
                    }`}
                  >
                    Risk only
                  </button>
                  {(['ALL', 'ready', 'conflict', 'risk', 'wait'] as DecisionFilter[]).map((state) => (
                    <button
                      key={state}
                      onClick={() => setDecisionFilter(state)}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                        decisionFilter === state
                          ? 'border-green-500/40 bg-green-500/15 text-green-300'
                          : 'border-white/10 bg-black/40 text-slate-400 hover:text-white'
                      }`}
                    >
                      {state === 'ALL' ? 'All states' : decisionStateMeta(state).label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <Tabs defaultValue="feed" className="w-full">
              <TabsList className="glass-card bg-black/40 p-1 border border-white/10 w-full md:w-auto inline-flex h-auto">
                <TabsTrigger value="feed" className="px-5 py-2 border border-transparent">
                  <Flame className="w-4 h-4" /> Feed
                </TabsTrigger>
                <TabsTrigger value="table" className="px-5 py-2 border border-transparent">
                  <Table2 className="w-4 h-4" /> Table
                </TabsTrigger>
                <TabsTrigger value="heatmap" className="px-5 py-2 border border-transparent">
                  <Grid3X3 className="w-4 h-4" /> Heatmap
                </TabsTrigger>
              </TabsList>

              <TabsContent value="feed" className="mt-6">
                {filteredRows.length ? (
                  <div className="space-y-6">
                    {groupedRows.map((group) => (
                      group.rows.length ? (
                        <section key={group.key} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h2 className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{group.label}</h2>
                            <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-bold text-slate-400">
                              {group.rows.length} tín hiệu
                            </span>
                          </div>
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {group.rows.map((row) => (
                              <FeedSignalCard
                                key={row.id}
                                row={row}
                                onOpen={(id) => router.push(`/proposal/${row.proposalId || id}`)}
                                onOpenToken={(symbol) => router.push(`/tokens/${symbol}`)}
                              />
                            ))}
                          </div>
                        </section>
                      ) : null
                    ))}
                  </div>
                ) : (
                  <div className="glass-card rounded-xl p-12 border border-dashed border-white/10 text-center">
                    <p className="text-slate-500">No signals match the selected filters.</p>
                    <button
                      onClick={() => {
                        setActionFilter('ALL');
                        setDecisionFilter('ALL');
                        setRiskOnly(false);
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-300 hover:bg-cyan-500/15 transition-colors"
                    >
                      Xem danh sách tín hiệu
                    </button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="table" className="mt-6">
                <section className="glass-card rounded-xl border border-white/5 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="bg-black/40 border-b border-white/5">
                        <tr>
                          {[
                            { key: 'rank', label: 'Rank' },
                            { key: 'token', label: 'Token' },
                            { key: 'layer2Action', label: 'L2 Action' },
                            { key: 'layer3Action', label: 'L3 Action' },
                            { key: 'signalScore', label: 'Quant score' },
                            { key: 'confidence', label: 'Confidence' },
                            { key: 'timeZ', label: 'Time-Z' },
                            { key: 'alphaZ', label: 'Alpha-Z' },
                            { key: 'btcTimeZ', label: 'BTC-Z' },
                            { key: 'uncertainty', label: 'Uncertainty' },
                            { key: 'health', label: 'Health' },
                            { key: 'backtest', label: 'Backtest' },
                            { key: 'decision', label: 'Decision' },
                            { key: 'divergence', label: 'Risk' },
                            { key: 'detectedAt', label: 'Detected' },
                            { key: 'expiresAt', label: 'Expiry' },
                            { key: 'cta', label: '' },
                          ].map((column) => (
                            <th key={column.key} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">
                              {['rank', 'signalScore', 'confidence', 'detectedAt', 'expiresAt'].includes(column.key) ? (
                                <button
                                  onClick={() => toggleSort(column.key as SortKey)}
                                  className="inline-flex items-center gap-1 hover:text-slate-300"
                                >
                                  {column.label}
                                  {sortKey === column.key ? (
                                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                  ) : null}
                                </button>
                              ) : column.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => {
                          const decisionState = decisionStateMeta(getDecisionState(row));

                          return (
                          <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                            <td className="px-4 py-4 font-mono text-slate-300">#{row.rank}</td>
                            <td className="px-4 py-4">
                              <button onClick={() => router.push(`/tokens/${row.tokenSymbol}`)} className="text-left group">
                                <span className="block font-bold text-white group-hover:text-cyan-300">{row.tokenSymbol}</span>
                                <span className="block max-w-[160px] truncate text-[10px] text-slate-500">{row.tokenName}</span>
                              </button>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-1 rounded-md border text-[10px] font-bold ${actionTone(row.layer2Action)}`}>{row.layer2Action}</span>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-1 rounded-md border text-[10px] font-bold ${actionTone(row.layer3Action || row.action)}`}>{row.layer3Action || 'n/a'}</span>
                            </td>
                            <td className={`px-4 py-4 font-mono font-bold ${scoreTone(row.signalScore)}`}>{formatScore(row.signalScore)}</td>
                            <td className="px-4 py-4 font-mono text-green-300">{row.confidence}%</td>
                            <td className={`px-4 py-4 font-mono ${scoreTone(row.zScore ?? 0)}`}>{formatScore(row.zScore)}</td>
                            <td className={`px-4 py-4 font-mono ${scoreTone(row.scoreComponents?.pureAlphaZ ?? 0)}`}>{formatScore(row.scoreComponents?.pureAlphaZ)}</td>
                            <td className={`px-4 py-4 font-mono ${scoreTone(row.scoreComponents?.btcTimeZ ?? 0)}`}>{formatScore(row.scoreComponents?.btcTimeZ)}</td>
                            <td className={`px-4 py-4 font-bold ${
                              row.semantics?.uncertainty?.severity === 'HIGH' ? 'text-red-300' : row.semantics?.uncertainty?.severity === 'MEDIUM' ? 'text-amber-300' : 'text-green-300'
                            }`}>
                              {row.semantics?.uncertainty?.label || 'Unknown'}
                            </td>
                            <td className={`px-4 py-4 font-bold ${
                              row.semantics?.health.severity === 'HIGH' ? 'text-red-300' : row.semantics?.health.severity === 'MEDIUM' ? 'text-amber-300' : 'text-green-300'
                            }`}>
                              {row.semantics?.health.label || 'OK'}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-1 rounded-md border text-[10px] font-bold ${backtestTone(row.backtest?.outcome)}`}>
                                {row.backtest?.outcome && row.backtest.outcome !== 'NOT_TESTED' ? row.backtest.outcome : 'n/a'}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-1 rounded-md border text-[10px] font-bold whitespace-nowrap ${decisionState.className}`}>
                                {decisionState.label}
                              </span>
                            </td>
                            <td className={`px-4 py-4 ${riskTone(row)}`}>{row.divergence === 'None' ? 'Clear' : row.divergence}</td>
                            <td className="px-4 py-4 text-slate-400">{formatDate(row.detectedAt)}</td>
                            <td className="px-4 py-4 text-slate-400">{formatDate(row.expiresAt)}</td>
                            <td className="px-4 py-4 text-right">
                              <button
                                onClick={() => router.push(`/proposal/${row.proposalId || row.id}`)}
                                className="text-xs font-bold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
                              >
                                Xem tín hiệu <ArrowRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {filteredRows.length === 0 && (
                    <div className="p-10 text-center text-slate-500">No signals match the selected filters.</div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="heatmap" className="mt-6">
                <SignalHeatmap rows={filteredRows} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
}
