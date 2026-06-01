'use client';

import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { SignalAnalyticsRow } from '@/lib/types/analytics';

function LeaderboardSignalCard({ row }: { row: SignalAnalyticsRow }) {
  const isPositive = row.signalScore >= 0;

  return (
    <button
      onClick={() => window.location.assign(`/proposal/${row.proposalId || row.id}`)}
      className="w-full rounded-xl border border-white/5 bg-black/30 p-4 text-left transition-colors hover:border-cyan-500/30 hover:bg-white/[0.03]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-white">{row.tokenSymbol}</p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-400">{row.rationaleSummary}</p>
        </div>
        <span className={`font-mono text-sm font-bold ${isPositive ? 'text-green-300' : 'text-red-300'}`}>
          {row.signalScore > 0 ? '+' : ''}{row.signalScore.toFixed(2)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest">
        <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-slate-400">#{row.rank}</span>
        <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-300">{row.action}</span>
        <span className="rounded-md border border-green-500/20 bg-green-500/10 px-2 py-1 text-green-300">{row.confidence}%</span>
      </div>
    </button>
  );
}

export function SignalLeaderboard({ rows }: { rows: SignalAnalyticsRow[] }) {
  const strongest = rows.filter((row) => row.signalScore > 0).slice(0, 3);
  const weakest = rows.filter((row) => row.signalScore < 0).slice(-3).reverse();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4 text-green-400" />
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Strongest Signals</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-1 gap-3">
          {strongest.map((row) => (
            <LeaderboardSignalCard
              key={row.id}
              row={row}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ArrowDownRight className="w-4 h-4 text-red-400" />
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Weakest Signals</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-1 gap-3">
          {weakest.map((row) => (
            <LeaderboardSignalCard
              key={row.id}
              row={row}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
