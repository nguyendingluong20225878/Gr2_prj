'use client';

import { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/app/components/ui/skeleton';
import { useSignalAnalytics } from '@/lib/hooks/useSignalAnalytics';
import type { SignalAnalyticsRow } from '@/lib/types/analytics';
import { AIInsightPanel } from './AIInsightPanel';
import { ExplainabilityDrawer } from './ExplainabilityDrawer';
import { RegimeStatus } from './RegimeStatus';
import { SignalHeatmap } from './SignalHeatmap';
import { SignalLeaderboard } from './SignalLeaderboard';
import { TokenMomentumTable } from './TokenMomentumTable';

export function AlphaMonitor() {
  const { rows, summary, loading, error } = useSignalAnalytics();
  const [selectedRow, setSelectedRow] = useState<SignalAnalyticsRow | null>(null);
  const [timeframe, setTimeframe] = useState('1D');

  if (error) {
    return (
      <div className="glass-card rounded-xl p-8 border border-red-500/30 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-red-300 mb-2">Alpha Monitor unavailable</h2>
        <p className="text-slate-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-bold mb-2">Daily Signal Analysis</p>
          <h1 className="text-4xl font-bold gradient-text">Alpha Monitor</h1>
          <p className="text-slate-400 mt-2 max-w-2xl">
            Scan token momentum, z-score pressure, confidence, and anomaly risk from the existing signal pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['4H', '1D', '3D', '7D'].map((item) => (
            <button
              key={item}
              onClick={() => setTimeframe(item)}
              className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
                timeframe === item ? 'bg-purple-500/20 border-purple-500/40 text-purple-200' : 'bg-black/20 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {item}
            </button>
          ))}
          <div className="px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-xs text-slate-400 flex items-center gap-2">
            <RefreshCw className="w-3 h-3" />
            Manual refresh via page reload
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-24 bg-white/5 rounded-xl" />)}
          </div>
          <Skeleton className="h-[520px] bg-white/5 rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-card rounded-xl p-12 border border-dashed border-white/10 text-center">
          <h2 className="text-xl font-bold text-white mb-2">No daily signals yet</h2>
          <p className="text-slate-500">Run the signal detector pipeline or loosen your filters once the daily API is available.</p>
        </div>
      ) : (
        <>
          <RegimeStatus summary={summary} />

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
            <div className="space-y-6">
              <SignalLeaderboard rows={rows} />
              <TokenMomentumTable rows={rows} onSelectRow={setSelectedRow} />
              <SignalHeatmap rows={rows} />
            </div>
            <AIInsightPanel rows={rows} summary={summary} />
          </div>
        </>
      )}

      <ExplainabilityDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
    </div>
  );
}
