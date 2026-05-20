'use client';

import { X } from 'lucide-react';
import type { SignalAnalyticsRow } from '@/lib/types/analytics';
import { TheEvidence } from '@/app/components/proposal/TheEvidence';
import { TheLogic } from '@/app/components/proposal/TheLogic';

export function ExplainabilityDrawer({
  row,
  onClose,
}: {
  row: SignalAnalyticsRow | null;
  onClose: () => void;
}) {
  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close drawer" />
      <aside className="relative z-10 h-full w-full max-w-xl overflow-y-auto bg-slate-950 border-l border-white/10 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Explainability</p>
            <h2 className="text-2xl font-bold text-white">{row.tokenSymbol}</h2>
            <p className="text-sm text-slate-400">{row.tokenName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="glass-card p-3 rounded-lg">
            <p className="text-[10px] uppercase text-slate-500 font-bold">Signal Score</p>
            <p className="text-xl font-mono text-cyan-300">{row.signalScore.toFixed(2)}</p>
          </div>
          <div className="glass-card p-3 rounded-lg">
            <p className="text-[10px] uppercase text-slate-500 font-bold">Confidence</p>
            <p className="text-xl font-mono text-green-300">{row.confidence}%</p>
          </div>
          <div className="glass-card p-3 rounded-lg">
            <p className="text-[10px] uppercase text-slate-500 font-bold">Divergence</p>
            <p className="text-sm text-amber-300">{row.divergence}</p>
          </div>
          <div className="glass-card p-3 rounded-lg">
            <p className="text-[10px] uppercase text-slate-500 font-bold">Action</p>
            <p className="text-sm text-white">{row.action}</p>
          </div>
        </div>

        <div className="space-y-5">
          <TheLogic reason={[row.rationaleSummary]} rationaleSummary={row.rationaleSummary} confidence={row.confidence} />
          <TheEvidence
            tokenSymbol={row.tokenSymbol}
            signalData={{
              sentimentType: row.sentimentShift,
              rationaleSummary: row.rationaleSummary,
              sources: row.sources,
            }}
          />
        </div>
      </aside>
    </div>
  );
}
