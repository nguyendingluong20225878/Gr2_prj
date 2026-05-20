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
  ShieldCheck,
  Table2,
} from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { SignalHeatmap } from '@/app/components/analytics/SignalHeatmap';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { useSignalAnalytics } from '@/lib/hooks/useSignalAnalytics';
import type { AnalyticsAction, SignalAnalyticsRow } from '@/lib/types/analytics';

type ActionFilter = 'ALL' | AnalyticsAction;
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

function riskTone(row: SignalAnalyticsRow) {
  if (row.divergence !== 'None') return 'text-amber-300';
  if (row.action === 'SELL') return 'text-red-300';
  return 'text-slate-500';
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

function FeedSignalCard({
  row,
  onOpen,
  onOpenToken,
}: {
  row: SignalAnalyticsRow;
  onOpen: (id: string) => void;
  onOpenToken: (symbol: string) => void;
}) {
  return (
    <article className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-white">{row.tokenSymbol}</span>
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${actionTone(row.action)}`}>
              {row.action}
            </span>
            <span className="text-[10px] text-slate-500">Rank #{row.rank}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 truncate">{row.tokenName}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-mono text-lg font-black ${scoreTone(row.signalScore)}`}>
            {formatScore(row.signalScore)}
          </p>
          <p className="text-[10px] uppercase text-slate-500">Quant score</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-300 line-clamp-3">{row.rationaleSummary}</p>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Confidence</p>
          <p className="mt-1 font-mono text-green-300">{row.confidence}%</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Z-score</p>
          <p className={`mt-1 font-mono ${scoreTone(row.zScore ?? 0)}`}>{formatScore(row.zScore)}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Sources</p>
          <p className="mt-1 font-mono text-cyan-300">{row.sources.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Expiry</p>
          <p className="mt-1 text-xs text-slate-300">{formatDate(row.expiresAt)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className={`text-xs ${riskTone(row)}`}>
          {row.divergence !== 'None' ? row.divergence : 'No active anomaly'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onOpenToken(row.tokenSymbol)}
            className="glass-card rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Token
          </button>
          <button
            onClick={() => onOpen(row.id)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
          >
            View Analysis <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function SignalsPage() {
  const router = useRouter();
  const { rows, summary, loading, error } = useSignalAnalytics();
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL');
  const [riskOnly, setRiskOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('signalScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => actionFilter === 'ALL' || row.action === actionFilter)
      .filter((row) => !riskOnly || row.divergence !== 'None' || row.action === 'SELL')
      .sort((a, b) => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        if (sortKey === 'detectedAt' || sortKey === 'expiresAt') {
          return (new Date(a[sortKey] || 0).getTime() - new Date(b[sortKey] || 0).getTime()) * direction;
        }
        return (Number(a[sortKey] ?? 0) - Number(b[sortKey] ?? 0)) * direction;
      });
  }, [actionFilter, riskOnly, rows, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('desc');
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
          <button
            onClick={() => router.push('/signals/daily')}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
          >
            Open Alpha Monitor <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {error ? (
          <div className="glass-card rounded-xl p-8 border border-red-500/30 text-red-300">{error}</div>
        ) : loading ? (
          <div className="glass-card rounded-xl p-8 text-slate-500">Loading signals...</div>
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
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {filteredRows.map((row) => (
                      <FeedSignalCard
                        key={row.id}
                        row={row}
                        onOpen={(id) => router.push(`/proposal/${id}`)}
                        onOpenToken={(symbol) => router.push(`/tokens/${symbol}`)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="glass-card rounded-xl p-12 border border-dashed border-white/10 text-center text-slate-500">
                    No signals match the selected filters.
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
                            { key: 'action', label: 'Action' },
                            { key: 'signalScore', label: 'Quant score' },
                            { key: 'confidence', label: 'Confidence' },
                            { key: 'zScore', label: 'Z-score' },
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
                        {filteredRows.map((row) => (
                          <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                            <td className="px-4 py-4 font-mono text-slate-300">#{row.rank}</td>
                            <td className="px-4 py-4">
                              <button onClick={() => router.push(`/tokens/${row.tokenSymbol}`)} className="text-left group">
                                <span className="block font-bold text-white group-hover:text-cyan-300">{row.tokenSymbol}</span>
                                <span className="block max-w-[160px] truncate text-[10px] text-slate-500">{row.tokenName}</span>
                              </button>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-1 rounded-md border text-[10px] font-bold ${actionTone(row.action)}`}>{row.action}</span>
                            </td>
                            <td className={`px-4 py-4 font-mono font-bold ${scoreTone(row.signalScore)}`}>{formatScore(row.signalScore)}</td>
                            <td className="px-4 py-4 font-mono text-green-300">{row.confidence}%</td>
                            <td className={`px-4 py-4 font-mono ${scoreTone(row.zScore ?? 0)}`}>{formatScore(row.zScore)}</td>
                            <td className={`px-4 py-4 ${riskTone(row)}`}>{row.divergence === 'None' ? 'Clear' : row.divergence}</td>
                            <td className="px-4 py-4 text-slate-400">{formatDate(row.detectedAt)}</td>
                            <td className="px-4 py-4 text-slate-400">{formatDate(row.expiresAt)}</td>
                            <td className="px-4 py-4 text-right">
                              <button
                                onClick={() => router.push(`/proposal/${row.id}`)}
                                className="text-xs font-bold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
                              >
                                Analysis <ArrowRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
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
