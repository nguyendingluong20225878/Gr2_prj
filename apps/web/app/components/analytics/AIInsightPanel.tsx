'use client';

import { Brain, Lightbulb, Radio } from 'lucide-react';
import type { SignalAnalyticsRow, SignalAnalyticsSummary } from '@/lib/types/analytics';

export function AIInsightPanel({
  rows,
  summary,
}: {
  rows: SignalAnalyticsRow[];
  summary: SignalAnalyticsSummary;
}) {
  const top = summary.strongestToken;
  const weakest = summary.weakestToken;
  const anomalies = rows.filter((row) => row.divergence !== 'None').slice(0, 4);

  return (
    <aside className="space-y-4">
      <section className="glass-card rounded-xl p-5 border border-cyan-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">AI Insight</h2>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          {summary.totalSignals === 0
            ? 'No live signals are available for this session.'
            : `Current board is ${summary.buyCount >= summary.sellCount ? 'constructive' : 'defensive'} with ${summary.buyCount} buy signals, ${summary.sellCount} sell signals, and average confidence at ${summary.averageConfidence}%.`}
        </p>
        {top && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-[10px] uppercase text-green-400 font-bold mb-1">Strongest setup</p>
            <p className="text-sm text-slate-200">{top.tokenSymbol}: score {top.signalScore.toFixed(2)}</p>
          </div>
        )}
        {weakest && (
          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-[10px] uppercase text-red-400 font-bold mb-1">Weakest setup</p>
            <p className="text-sm text-slate-200">{weakest.tokenSymbol}: score {weakest.signalScore.toFixed(2)}</p>
          </div>
        )}
      </section>

      <section className="glass-card rounded-xl p-5 border border-amber-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Radio className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Anomaly Watch</h2>
        </div>
        {anomalies.length === 0 ? (
          <p className="text-sm text-slate-500">No anomaly detected from available fields.</p>
        ) : (
          <div className="space-y-2">
            {anomalies.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-slate-200">{row.tokenSymbol}</span>
                <span className="text-amber-300 text-xs text-right">{row.divergence}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card rounded-xl p-5 border border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Rollout Note</h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Delta rank, liquidity shift, and multi-timeframe fields show n/a until the daily aggregation API provides historical snapshots.
        </p>
      </section>
    </aside>
  );
}
