'use client';

import { Activity, AlertTriangle, Clock, ShieldCheck } from 'lucide-react';
import type { SignalAnalyticsSummary } from '@/lib/types/analytics';

function formatTime(value?: string) {
  if (!value) return 'No data';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RegimeStatus({ summary }: { summary: SignalAnalyticsSummary }) {
  const breadth = summary.totalSignals ? Math.round((summary.buyCount / summary.totalSignals) * 100) : 0;
  const regime = breadth >= 55 ? 'Risk-on' : breadth <= 30 ? 'Defensive' : 'Mixed';

  const cards = [
    { label: 'Market Regime', value: regime, icon: Activity, tone: breadth >= 55 ? 'text-green-400' : breadth <= 30 ? 'text-red-400' : 'text-purple-400' },
    { label: 'Avg Confidence', value: `${summary.averageConfidence}%`, icon: ShieldCheck, tone: 'text-green-400' },
    { label: 'Anomalies', value: String(summary.anomalyCount), icon: AlertTriangle, tone: summary.anomalyCount ? 'text-amber-400' : 'text-slate-400' },
    { label: 'Last Signal', value: formatTime(summary.lastUpdated), icon: Clock, tone: 'text-slate-300' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="glass-card rounded-xl p-4 border border-white/5 bg-black/30">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{card.label}</p>
              <Icon className={`w-4 h-4 ${card.tone}`} />
            </div>
            <p className={`text-lg font-bold ${card.tone}`}>{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}
