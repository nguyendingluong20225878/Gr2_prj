'use client';

import { Fragment } from 'react';
import type { SignalAnalyticsRow } from '@/lib/types/analytics';

const metrics = [
  { key: 'signalScore', label: 'Signal' },
  { key: 'zScore', label: 'Z' },
  { key: 'deltaZScore', label: 'Delta Z' },
  { key: 'momentumAcceleration', label: 'Accel' },
  { key: 'confidence', label: 'Conf' },
] as const;

function cellTone(value: number | null | undefined, metric: string) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'bg-slate-800/70 text-slate-500';
  const normalized = metric === 'confidence' ? (value - 50) / 50 : value;
  if (normalized > 1.5) return 'bg-green-500/40 text-green-100';
  if (normalized > 0.4) return 'bg-green-500/20 text-green-200';
  if (normalized < -1.5) return 'bg-red-500/40 text-red-100';
  if (normalized < -0.4) return 'bg-red-500/20 text-red-200';
  return 'bg-purple-500/10 text-slate-300';
}

export function SignalHeatmap({ rows }: { rows: SignalAnalyticsRow[] }) {
  const displayRows = rows.slice(0, 12);

  return (
    <section className="glass-card rounded-xl p-5 border border-white/5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Signal Heatmap</h2>
        <p className="text-[10px] text-slate-500">Top 12 by absolute signal strength</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px] grid gap-1" style={{ gridTemplateColumns: `96px repeat(${metrics.length}, minmax(86px, 1fr))` }}>
          <div />
          {metrics.map((metric) => (
            <div key={metric.key} className="text-[10px] uppercase text-slate-500 font-bold text-center py-1">
              {metric.label}
            </div>
          ))}
          {displayRows.map((row) => (
            <Fragment key={row.id}>
              <div key={`${row.id}-label`} className="text-xs font-bold text-slate-200 py-2 pr-2 truncate">
                {row.tokenSymbol}
              </div>
              {metrics.map((metric) => {
                const value = row[metric.key];
                return (
                  <div
                    key={`${row.id}-${metric.key}`}
                    className={`rounded-md px-2 py-2 text-center text-xs font-mono ${cellTone(value as number | null, metric.key)}`}
                  >
                    {value === null || value === undefined ? 'n/a' : Number(value).toFixed(metric.key === 'confidence' ? 0 : 2)}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
