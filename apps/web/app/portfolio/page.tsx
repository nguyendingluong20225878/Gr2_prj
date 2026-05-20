'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Eye,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { useSignalAnalytics } from '@/lib/hooks/useSignalAnalytics';
import { toast } from 'sonner';

type Holding = {
  symbol: string;
  balance: number;
  price: number;
  value: number;
};

type Investment = {
  _id: string;
  symbol: string;
  entryPrice: number;
  size: number;
  leverage: number;
  direction: string;
  proposalId?: string;
  roi: number;
};

type WatchlistItem = {
  _id: string;
  tokenSymbol: string;
  title?: string;
  roi: number;
  confidence?: number;
};

type PortfolioResponse = {
  holdings: Holding[];
  investments: Investment[];
  watchlist: WatchlistItem[];
  stats?: {
    totalValue?: number;
    activeCount?: number;
    watchlistCount?: number;
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

function formatNumber(value: number, decimals = 4) {
  if (!Number.isFinite(value)) return '0';
  return Number(value.toFixed(decimals)).toLocaleString();
}

function signalTone(action?: string) {
  if (action === 'BUY') return 'text-green-400 border-green-500/30 bg-green-500/10';
  if (action === 'SELL') return 'text-red-400 border-red-500/30 bg-red-500/10';
  return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
}

export default function PortfolioPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { rows: signalRows } = useSignalAnalytics();

  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchPortfolio = async () => {
    if (!publicKey) {
      setLoading(false);
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/portfolio?wallet=${publicKey.toBase58()}`);
      if (!res.ok) throw new Error('Failed to load portfolio');
      setData((await res.json()) as PortfolioResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load portfolio';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, [publicKey]);

  const handleSyncBalances = async () => {
    if (!publicKey) return toast.error('Please connect your wallet first.');

    setIsSyncing(true);
    try {
      const balances: Array<{ tokenAddress: string; balance: string; updatedAt: Date }> = [];

      const solBalance = await connection.getBalance(publicKey);
      balances.push({
        tokenAddress: 'So11111111111111111111111111111111111111112',
        balance: (solBalance / LAMPORTS_PER_SOL).toString(),
        updatedAt: new Date(),
      });

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      tokenAccounts.value.forEach((account) => {
        const info = account.account.data.parsed.info;
        const amount = info.tokenAmount.uiAmountString;
        if (parseFloat(amount) > 0) {
          balances.push({
            tokenAddress: info.mint,
            balance: amount,
            updatedAt: new Date(),
          });
        }
      });

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: publicKey.toBase58(), balances }),
      });

      if (!res.ok) throw new Error('Failed to update database');

      const result = await res.json();
      if (result.user) setUser(result.user);
      toast.success(`Synced ${balances.length} assets.`);
      await fetchPortfolio();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync wallet balances';
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const portfolio = data || { holdings: [], investments: [], watchlist: [], stats: { totalValue: 0 } };
  const totalValue = portfolio.stats?.totalValue || portfolio.holdings.reduce((sum, holding) => sum + holding.value, 0);

  const exposureRows = useMemo(() => {
    return [...portfolio.holdings]
      .sort((a, b) => b.value - a.value)
      .map((holding) => {
        const signal = signalRows.find((row) => row.tokenSymbol.toUpperCase() === holding.symbol.toUpperCase());
        const allocation = totalValue > 0 ? (holding.value / totalValue) * 100 : 0;
        return { ...holding, allocation, signal };
      });
  }, [portfolio.holdings, signalRows, totalValue]);

  const overlays = useMemo(() => {
    const heldSymbols = new Set(portfolio.holdings.map((holding) => holding.symbol.toUpperCase()));
    const heldAlerts = signalRows
      .filter((row) => heldSymbols.has(row.tokenSymbol.toUpperCase()))
      .filter((row) => row.action === 'SELL' || row.divergence !== 'None')
      .slice(0, 3);
    const missedBuys = signalRows
      .filter((row) => !heldSymbols.has(row.tokenSymbol.toUpperCase()))
      .filter((row) => row.action === 'BUY' && row.confidence >= 70)
      .slice(0, 3);
    return { heldAlerts, missedBuys };
  }, [portfolio.holdings, signalRows]);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-bold mb-2">Portfolio Exposure</p>
            <h1 className="text-4xl font-bold gradient-text">Portfolio</h1>
            <p className="text-slate-400 mt-2 max-w-2xl">
              Understand what you own, where exposure is concentrated, and which signals affect your holdings.
            </p>
          </div>
          <button
            onClick={handleSyncBalances}
            disabled={isSyncing || !publicKey}
            className="glass-card inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 px-4 py-3 text-sm font-bold text-cyan-300 hover:bg-cyan-500/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing wallet...' : 'Sync Wallet'}
          </button>
        </div>

        {!publicKey ? (
          <div className="glass-card rounded-xl border border-dashed border-white/10 p-12 text-center">
            <Wallet className="mx-auto mb-4 h-10 w-10 text-slate-600" />
            <h2 className="text-xl font-bold text-white">Connect wallet to view portfolio exposure</h2>
            <p className="mt-2 text-sm text-slate-500">Your exposure overlay depends on wallet holdings.</p>
          </div>
        ) : error ? (
          <div className="glass-card rounded-xl border border-red-500/30 p-8 text-red-300">{error}</div>
        ) : loading ? (
          <div className="glass-card rounded-xl p-12 text-center text-slate-500">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-cyan-400" />
            Loading portfolio...
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Net worth', value: formatCurrency(totalValue), icon: Wallet, tone: 'text-cyan-300' },
                { label: 'Holdings', value: portfolio.holdings.length, icon: BarChart3, tone: 'text-slate-200' },
                { label: 'Open positions', value: portfolio.investments.length, icon: TrendingUp, tone: 'text-green-400' },
                { label: 'Risk overlays', value: overlays.heldAlerts.length, icon: ShieldAlert, tone: overlays.heldAlerts.length ? 'text-amber-300' : 'text-slate-400' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="glass-card rounded-xl border border-white/5 bg-black/40 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.label}</p>
                      <Icon className={`h-4 w-4 ${item.tone}`} />
                    </div>
                    <p className={`mt-3 text-xl font-bold ${item.tone}`}>{item.value}</p>
                  </div>
                );
              })}
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
              <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Asset Exposure</h2>
                    <p className="mt-1 text-xs text-slate-500">Allocation, balance, price, and active signal affecting each holding.</p>
                  </div>
                </div>

                {exposureRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-10 text-center text-slate-500">
                    No wallet assets found. Sync wallet balances to populate exposure.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exposureRows.map((holding) => (
                      <div key={holding.symbol} className="rounded-xl border border-white/5 bg-black/40 p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-bold text-white">{holding.symbol}</p>
                              {holding.signal && (
                                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${signalTone(holding.signal.action)}`}>
                                  {holding.signal.action} signal
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatNumber(holding.balance)} tokens at {formatCurrency(holding.price, 6)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-lg font-bold text-white">{formatCurrency(holding.value)}</p>
                            <p className="text-xs text-slate-500">{holding.allocation.toFixed(1)}% allocation</p>
                          </div>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400" style={{ width: `${Math.min(holding.allocation, 100)}%` }} />
                        </div>
                        {holding.signal && (
                          <button
                            onClick={() => router.push(`/proposal/${holding.signal?.id}`)}
                            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-200"
                          >
                            Review affected signal <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <aside className="space-y-6">
                <section className="glass-card rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                  <h2 className="text-sm font-bold text-amber-200 uppercase tracking-widest">Personalized Signal Overlay</h2>
                  <div className="mt-4 space-y-3">
                    {overlays.heldAlerts.length ? overlays.heldAlerts.map((row) => (
                      <button
                        key={row.id}
                        onClick={() => router.push(`/proposal/${row.id}`)}
                        className="w-full rounded-xl border border-white/5 bg-black/40 p-3 text-left hover:border-amber-500/30 transition-colors"
                      >
                        <p className="font-bold text-white">{row.tokenSymbol}</p>
                        <p className="mt-1 text-sm text-amber-200">{row.action === 'SELL' ? 'You hold this and system suggests SELL' : row.divergence}</p>
                      </button>
                    )) : (
                      <p className="rounded-xl border border-dashed border-white/10 bg-black/30 p-4 text-sm text-slate-500">
                        No urgent signals affecting current holdings.
                      </p>
                    )}
                  </div>
                </section>

                <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                  <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Opportunities Not Held</h2>
                  <div className="mt-4 space-y-3">
                    {overlays.missedBuys.length ? overlays.missedBuys.map((row) => (
                      <button
                        key={row.id}
                        onClick={() => router.push(`/proposal/${row.id}`)}
                        className="w-full rounded-xl border border-white/5 bg-black/40 p-3 text-left hover:border-cyan-500/30 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-bold text-white">{row.tokenSymbol}</p>
                          <p className="font-mono text-green-300">{row.confidence}%</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">{row.rationaleSummary}</p>
                      </button>
                    )) : (
                      <p className="rounded-xl border border-dashed border-white/10 bg-black/30 p-4 text-sm text-slate-500">
                        No high-confidence BUY signals outside your holdings.
                      </p>
                    )}
                  </div>
                </section>

                <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                  <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Watchlist</h2>
                  <div className="mt-4 space-y-3">
                    {portfolio.watchlist.slice(0, 4).map((item) => (
                      <button
                        key={item._id}
                        onClick={() => router.push(`/proposal/${item._id}`)}
                        className="w-full rounded-xl border border-white/5 bg-black/40 p-3 text-left hover:border-purple-500/30 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-bold text-purple-300">{item.tokenSymbol}</p>
                          <p className="text-xs text-slate-500">{item.confidence ?? 0}% conf</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-400 line-clamp-1">{item.title}</p>
                      </button>
                    ))}
                    {portfolio.watchlist.length === 0 && (
                      <p className="rounded-xl border border-dashed border-white/10 bg-black/30 p-4 text-sm text-slate-500">
                        No watchlist proposals.
                      </p>
                    )}
                  </div>
                </section>

                <button
                  onClick={() => router.push('/positions')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
                >
                  Manage Positions <ArrowRight className="h-4 w-4" />
                </button>
              </aside>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
