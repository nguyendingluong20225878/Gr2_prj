'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Skeleton } from '@/app/components/ui/skeleton';
import { useSignalAnalytics } from '@/lib/hooks/useSignalAnalytics';
import { decisionStateMeta, getDecisionState } from '@/app/components/analytics/decisionState';
import type { SignalAnalyticsRow } from '@/lib/types/analytics';
import { useTradingDemoStore } from '@/app/contexts/TradingDemoContext';

type PositionRow = {
  _id: string;
  symbol: string;
  entryPrice: number;
  size: number;
  leverage: number;
  direction: string;
  executedPrice?: number;
  executionId?: string;
  createdAt?: string | Date;
  proposalId?: string;
  requestedPrice?: number;
  slippagePct?: number;
  txHash?: string;
  pnl: number;
  roi: number;
  riskLevel?: string;
  status?: 'open' | 'closed';
};

type PortfolioResponse = {
  investments?: PositionRow[];
  stats?: {
    activeCount?: number;
  };
};

function formatCurrency(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatDate(value?: string | Date) {
  if (!value) return 'n/a';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function directionConfig(direction: string) {
  const normalized = direction?.toUpperCase();
  if (normalized === 'SHORT') {
    return {
      label: 'SHORT',
      icon: ArrowDownRight,
      text: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
    };
  }

  return {
    label: 'LONG',
    icon: ArrowUpRight,
    text: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
  };
}

function riskLabel(position: PositionRow) {
  if (position.leverage >= 5) return { label: 'High leverage', tone: 'text-amber-300' };
  if (position.roi < 0) return { label: 'Underwater', tone: 'text-red-300' };
  return { label: 'Normal', tone: 'text-green-300' };
}

function deriveNextAction(position: PositionRow) {
  if (position.roi < 0) return { label: 'Xem lại lệnh', tone: 'text-red-300' };
  if (position.leverage >= 5) return { label: 'Giảm rủi ro', tone: 'text-amber-300' };
  return { label: 'Theo dõi', tone: 'text-green-300' };
}

function findSignalForPosition(position: PositionRow, rows: SignalAnalyticsRow[]) {
  return rows.find((row) => row.proposalId === position.proposalId)
    || rows.find((row) => row.tokenSymbol.toUpperCase() === position.symbol.toUpperCase());
}

function hasSignalChanged(position: PositionRow, signal?: SignalAnalyticsRow) {
  if (!signal) return false;
  const direction = position.direction?.toUpperCase();
  if (direction === 'LONG' && signal.action === 'SELL') return true;
  if (direction === 'SHORT' && signal.action === 'BUY') return true;
  return getDecisionState(signal) === 'conflict' || getDecisionState(signal) === 'risk';
}

export default function PositionsPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const { rows: signalRows } = useSignalAnalytics();
  const { closePosition, positions: demoPositions } = useTradingDemoStore();
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<PositionRow | null>(null);

  const fetchPositions = useCallback(async (options?: { silent?: boolean }) => {
    if (!publicKey) {
      setPositions([]);
      setLoading(false);
      setLastUpdatedAt(new Date().toISOString());
      return;
    }

    if (!options?.silent) setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/portfolio?wallet=${publicKey.toBase58()}`);
      if (!res.ok) throw new Error('Failed to load positions');
      const data = (await res.json()) as PortfolioResponse;
      setPositions(data.investments || []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load positions';
      setError(message);
      setLastUpdatedAt(new Date().toISOString());
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    void fetchPositions();
  }, [fetchPositions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPositions();
    } finally {
      setRefreshing(false);
    }
  };

  const openDemoPositions = useMemo<PositionRow[]>(() => {
    return demoPositions
      .filter((position) => position.status === 'open')
      .map((position) => ({
        _id: position._id,
        createdAt: position.createdAt,
        direction: position.direction,
        entryPrice: position.entryPrice,
        executedPrice: position.executedPrice,
        executionId: position.executionId,
        leverage: position.leverage,
        pnl: position.pnl,
        proposalId: position.proposalId,
        requestedPrice: position.entryPrice,
        riskLevel: position.riskLevel,
        roi: position.roi,
        size: position.size,
        slippagePct: position.slippagePct,
        status: position.status,
        symbol: position.symbol,
        txHash: position.txHash,
      }));
  }, [demoPositions]);

  const allPositions = useMemo<PositionRow[]>(() => {
    const apiWithoutDemoDuplicates = positions.filter((position) => {
      return !openDemoPositions.some((demoPosition) => demoPosition.proposalId === position.proposalId);
    });
    return [...openDemoPositions, ...apiWithoutDemoDuplicates];
  }, [openDemoPositions, positions]);

  const summary = useMemo(() => {
    const totalSize = allPositions.reduce((sum, position) => sum + (position.size || 0), 0);
    const longCount = allPositions.filter((position) => position.direction?.toUpperCase() !== 'SHORT').length;
    const shortCount = allPositions.filter((position) => position.direction?.toUpperCase() === 'SHORT').length;
    const highRiskCount = allPositions.filter((position) => position.leverage >= 5 || position.roi < 0 || position.riskLevel === 'HIGH').length;
    const averageRoi = allPositions.length
      ? allPositions.reduce((sum, position) => sum + (position.roi || 0), 0) / allPositions.length
      : 0;

    return { averageRoi, highRiskCount, longCount, shortCount, totalSize };
  }, [allPositions]);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-bold mb-2">Trading Workspace</p>
            <h1 className="text-4xl font-bold gradient-text">Positions</h1>
            <p className="text-slate-400 mt-2 max-w-2xl">
              Monitor active trades, linked proposals, exposure, leverage, and next management action after execution.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-400">
              Last updated {formatDate(lastUpdatedAt || undefined)}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-200 hover:bg-cyan-500/15 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => router.push('/signals')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
            >
              Đánh giá lệnh mới <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!publicKey && openDemoPositions.length === 0 ? (
          <div className="glass-card rounded-xl border border-dashed border-white/10 p-12 text-center">
            <Wallet className="mx-auto mb-4 h-10 w-10 text-slate-600" />
            <h2 className="text-xl font-bold text-white">Connect wallet to view open positions</h2>
            <p className="mt-2 text-sm text-slate-500">Positions are tied to the wallet that executed the proposal.</p>
          </div>
        ) : error && openDemoPositions.length === 0 ? (
          <div className="glass-card rounded-xl border border-red-500/30 p-8 text-red-300">
            <p>{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/15 transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : loading && openDemoPositions.length === 0 ? (
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              Loading positions...
            </div>
            <Skeleton className="h-16 w-full bg-white/10" />
            <Skeleton className="h-16 w-full bg-white/10" />
            <Skeleton className="h-16 w-full bg-white/10" />
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Open', value: allPositions.length, icon: BarChart3, tone: 'text-cyan-400' },
                { label: 'Long', value: summary.longCount, icon: ArrowUpRight, tone: 'text-green-400' },
                { label: 'Short', value: summary.shortCount, icon: ArrowDownRight, tone: 'text-red-400' },
                { label: 'Total size', value: formatCurrency(summary.totalSize), icon: Wallet, tone: 'text-slate-200' },
                { label: 'Avg ROI', value: `${summary.averageRoi >= 0 ? '+' : ''}${summary.averageRoi.toFixed(2)}%`, icon: RefreshCw, tone: summary.averageRoi >= 0 ? 'text-green-400' : 'text-red-400' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="glass-card rounded-xl border border-white/5 bg-black/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.label}</p>
                      <Icon className={`h-4 w-4 ${item.tone}`} />
                    </div>
                    <p className={`mt-3 text-xl font-bold ${item.tone}`}>{item.value}</p>
                  </div>
                );
              })}
            </section>

            {summary.highRiskCount > 0 && (
              <section className="glass-card rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" />
                  <div>
                    <p className="font-bold text-amber-200">{summary.highRiskCount} position needs review</p>
                    <p className="mt-1 text-sm text-slate-400">
                      High leverage or negative ROI positions should be re-evaluated against the original proposal.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {allPositions.length === 0 ? (
              <div className="glass-card rounded-xl border border-dashed border-white/10 p-12 text-center">
                <BarChart3 className="mx-auto mb-4 h-10 w-10 text-slate-600" />
                <h2 className="text-xl font-bold text-white">No open positions</h2>
                <p className="mt-2 text-sm text-slate-500">Vào lệnh từ proposal BUY/SELL để quản lý tại đây.</p>
                <button
                  onClick={() => router.push('/signals')}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
                >
                  Đánh giá lệnh <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <section className="glass-card rounded-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1080px] text-sm">
                      <thead className="bg-black/40 border-b border-white/5">
                        <tr>
                        {['Position', 'Direction', 'Entry', 'Size', 'Leverage', 'ROI', 'Risk', 'Signal', 'Execution', 'Next action', 'Opened', 'Action'].map((label) => (
                          <th key={label} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allPositions.map((position) => {
                        const direction = directionConfig(position.direction);
                        const DirectionIcon = direction.icon;
                        const risk = riskLabel(position);
                        const nextAction = deriveNextAction(position);
                        const linkedSignal = findSignalForPosition(position, signalRows);
                        const signalChanged = hasSignalChanged(position, linkedSignal);
                        const signalState = linkedSignal ? decisionStateMeta(getDecisionState(linkedSignal)) : null;

                        return (
                          <tr
                            key={position._id}
                            className={`border-b transition-colors hover:bg-white/[0.03] ${
                              signalChanged ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/5'
                            }`}
                          >
                            <td className="px-4 py-4">
                              <p className="font-bold text-white">{position.symbol}</p>
                              <p className="mt-1 max-w-[180px] truncate font-mono text-[10px] text-slate-500">{position._id}</p>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${direction.bg} ${direction.border} ${direction.text}`}>
                                <DirectionIcon className="h-3 w-3" />
                                {direction.label}
                              </span>
                            </td>
                            <td className="px-4 py-4 font-mono text-slate-200">{formatCurrency(position.entryPrice)}</td>
                            <td className="px-4 py-4 font-mono text-slate-200">{formatCurrency(position.size)}</td>
                            <td className="px-4 py-4 font-mono text-cyan-300">{position.leverage}x</td>
                            <td className={`px-4 py-4 font-mono font-bold ${position.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {position.roi >= 0 ? '+' : ''}{position.roi.toFixed(2)}%
                            </td>
                            <td className={`px-4 py-4 font-bold ${risk.tone}`}>{risk.label}</td>
                            <td className="px-4 py-4">
                              {signalState ? (
                                <div className="space-y-1">
                                  <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-bold ${signalState.className}`}>
                                    {signalState.label}
                                  </span>
                                  {signalChanged && <p className="text-[10px] font-bold text-amber-300">Tín hiệu đã đổi hướng/rủi ro</p>}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500">Chưa có tín hiệu mới</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {position.executionId ? (
                                <div className="space-y-1">
                                  <p className="font-mono text-xs text-cyan-300">{position.executionId.slice(0, 8)}...</p>
                                  <p className="text-[10px] text-slate-500">Slip {(position.slippagePct || 0).toFixed(2)}%</p>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500">n/a</span>
                              )}
                            </td>
                            <td className={`px-4 py-4 font-bold ${nextAction.tone}`}>{nextAction.label}</td>
                            <td className="px-4 py-4 text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(position.createdAt)}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => setSelectedPosition(position)}
                                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:border-cyan-500/30 transition-colors"
                                >
                                  Quản lý rủi ro
                                </button>
                                {position.proposalId && (
                                  <button
                                    onClick={() => router.push(`/proposal/${position.proposalId}`)}
                                    className="inline-flex items-center gap-1 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/15 transition-colors"
                                  >
                                    Xem tín hiệu <ExternalLink className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {selectedPosition && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg rounded-xl border border-white/10 p-6 shadow-2xl shadow-purple-900/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-bold mb-2">Quản lý rủi ro</p>
                  <h2 className="text-2xl font-bold text-white">{selectedPosition.symbol}</h2>
                </div>
                <button onClick={() => setSelectedPosition(null)} className="text-slate-500 hover:text-white">
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Entry</p>
                  <p className="mt-2 font-mono text-white">{formatCurrency(selectedPosition.entryPrice)}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Size</p>
                  <p className="mt-2 font-mono text-white">{formatCurrency(selectedPosition.size)}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Leverage</p>
                  <p className="mt-2 font-mono text-cyan-300">{selectedPosition.leverage}x</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Risk</p>
                  <p className={`mt-2 font-bold ${riskLabel(selectedPosition).tone}`}>{riskLabel(selectedPosition).label}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/40 p-4 col-span-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Next action</p>
                  <p className={`mt-2 font-bold ${deriveNextAction(selectedPosition).tone}`}>{deriveNextAction(selectedPosition).label}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/40 p-4 col-span-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Execution data</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <span className="text-slate-500">Requested</span>
                    <span className="text-right font-mono text-slate-200">{formatCurrency(selectedPosition.requestedPrice || selectedPosition.entryPrice)}</span>
                    <span className="text-slate-500">Executed</span>
                    <span className="text-right font-mono text-slate-200">{formatCurrency(selectedPosition.executedPrice || selectedPosition.entryPrice)}</span>
                    <span className="text-slate-500">Slippage</span>
                    <span className="text-right font-mono text-cyan-300">{(selectedPosition.slippagePct || 0).toFixed(2)}%</span>
                    <span className="text-slate-500">Tx</span>
                    <span className="truncate text-right font-mono text-cyan-300">{selectedPosition.txHash || selectedPosition.executionId || 'n/a'}</span>
                  </div>
                </div>
                {(() => {
                  const linkedSignal = findSignalForPosition(selectedPosition, signalRows);
                  const signalState = linkedSignal ? decisionStateMeta(getDecisionState(linkedSignal)) : null;
                  const signalChanged = hasSignalChanged(selectedPosition, linkedSignal);

                  return (
                    <div className="rounded-xl border border-white/5 bg-black/40 p-4 col-span-2">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Signal intelligence</p>
                      {signalState ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${signalState.className}`}>{signalState.label}</span>
                          {signalChanged && <span className="text-xs font-bold text-amber-300">Cần xem lại thesis</span>}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">Không có tín hiệu mới khớp vị thế này.</p>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="mt-6 space-y-3">
                {selectedPosition.proposalId && (
                  <button
                    onClick={() => router.push(`/proposal/${selectedPosition.proposalId}`)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
                  >
                    Xem lại lệnh <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    closePosition(selectedPosition._id);
                    setSelectedPosition(null);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 hover:bg-red-500/15 transition-colors"
                >
                  Đóng lệnh demo <AlertTriangle className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
