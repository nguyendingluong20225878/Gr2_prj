'use client';

import { useEffect, useMemo, useState } from 'react';
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

type PositionRow = {
  _id: string;
  symbol: string;
  entryPrice: number;
  size: number;
  leverage: number;
  direction: string;
  createdAt?: string | Date;
  proposalId?: string;
  pnl: number;
  roi: number;
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

export default function PositionsPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<PositionRow | null>(null);

  useEffect(() => {
    async function fetchPositions() {
      if (!publicKey) {
        setPositions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/portfolio?wallet=${publicKey.toBase58()}`);
        if (!res.ok) throw new Error('Failed to load positions');
        const data = (await res.json()) as PortfolioResponse;
        setPositions(data.investments || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load positions';
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchPositions();
  }, [publicKey]);

  const summary = useMemo(() => {
    const totalSize = positions.reduce((sum, position) => sum + (position.size || 0), 0);
    const longCount = positions.filter((position) => position.direction?.toUpperCase() !== 'SHORT').length;
    const shortCount = positions.filter((position) => position.direction?.toUpperCase() === 'SHORT').length;
    const highRiskCount = positions.filter((position) => position.leverage >= 5 || position.roi < 0).length;
    const averageRoi = positions.length
      ? positions.reduce((sum, position) => sum + (position.roi || 0), 0) / positions.length
      : 0;

    return { averageRoi, highRiskCount, longCount, shortCount, totalSize };
  }, [positions]);

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
          <button
            onClick={() => router.push('/signals')}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
          >
            Find New Signals <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {!publicKey ? (
          <div className="glass-card rounded-xl border border-dashed border-white/10 p-12 text-center">
            <Wallet className="mx-auto mb-4 h-10 w-10 text-slate-600" />
            <h2 className="text-xl font-bold text-white">Connect wallet to view open positions</h2>
            <p className="mt-2 text-sm text-slate-500">Positions are tied to the wallet that executed the proposal.</p>
          </div>
        ) : error ? (
          <div className="glass-card rounded-xl border border-red-500/30 p-8 text-red-300">{error}</div>
        ) : loading ? (
          <div className="glass-card rounded-xl p-12 text-center text-slate-500">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-cyan-400" />
            Loading positions...
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Open', value: positions.length, icon: BarChart3, tone: 'text-cyan-400' },
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

            {positions.length === 0 ? (
              <div className="glass-card rounded-xl border border-dashed border-white/10 p-12 text-center">
                <BarChart3 className="mx-auto mb-4 h-10 w-10 text-slate-600" />
                <h2 className="text-xl font-bold text-white">No open positions</h2>
                <p className="mt-2 text-sm text-slate-500">Execute a BUY/SELL proposal to manage it here.</p>
                <button
                  onClick={() => router.push('/signals')}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
                >
                  Review Signals <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <section className="glass-card rounded-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-black/40 border-b border-white/5">
                      <tr>
                        {['Position', 'Direction', 'Entry', 'Size', 'Leverage', 'ROI', 'Risk', 'Opened', 'Action'].map((label) => (
                          <th key={label} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((position) => {
                        const direction = directionConfig(position.direction);
                        const DirectionIcon = direction.icon;
                        const risk = riskLabel(position);

                        return (
                          <tr key={position._id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
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
                                  Manage
                                </button>
                                {position.proposalId && (
                                  <button
                                    onClick={() => router.push(`/proposal/${position.proposalId}`)}
                                    className="inline-flex items-center gap-1 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/15 transition-colors"
                                  >
                                    Proposal <ExternalLink className="h-3 w-3" />
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
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-bold mb-2">Manage Position</p>
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
              </div>

              <div className="mt-6 space-y-3">
                {selectedPosition.proposalId && (
                  <button
                    onClick={() => router.push(`/proposal/${selectedPosition.proposalId}`)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
                  >
                    Re-evaluate Proposal <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedPosition(null)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 hover:bg-red-500/15 transition-colors"
                >
                  Close Position CTA Pending <AlertTriangle className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
