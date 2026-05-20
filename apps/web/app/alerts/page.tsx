'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Clock,
  EyeOff,
  ShieldAlert,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { useSignalAnalytics } from '@/lib/hooks/useSignalAnalytics';
import type { SignalAnalyticsRow } from '@/lib/types/analytics';

type AlertType = 'VOLATILITY' | 'CONFLICT' | 'SELL' | 'EXPIRING' | 'LOW_CONFIDENCE' | 'HOLD_STRENGTH';

type AlertItem = {
  id: string;
  row: SignalAnalyticsRow;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  type: AlertType;
};

function formatTime(value?: string) {
  if (!value) return 'No expiry';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function severityTone(severity: AlertItem['severity']) {
  if (severity === 'HIGH') return 'text-red-300 border-red-500/30 bg-red-500/10';
  if (severity === 'MEDIUM') return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  return 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10';
}

function typeLabel(type: AlertType) {
  const labels: Record<AlertType, string> = {
    CONFLICT: 'Score/confidence conflict',
    EXPIRING: 'Expiring soon',
    HOLD_STRENGTH: 'Strong score but HOLD',
    LOW_CONFIDENCE: 'Low confidence',
    SELL: 'Sell signal',
    VOLATILITY: 'Volatility anomaly',
  };
  return labels[type];
}

export default function AlertsPage() {
  const router = useRouter();
  const { rows, loading, error } = useSignalAnalytics();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const alerts = useMemo<AlertItem[]>(() => {
    const now = Date.now();

    return rows.flatMap((row) => {
      const items: AlertItem[] = [];
      const expiresInHours = row.expiresAt ? (new Date(row.expiresAt).getTime() - now) / 36e5 : null;

      if (row.volatilityFlag !== null && row.volatilityFlag > 0.82) {
        items.push({
          id: `${row.id}-volatility`,
          row,
          severity: 'HIGH',
          title: `${row.tokenSymbol} has elevated volatility pressure`,
          type: 'VOLATILITY',
        });
      }

      if (row.divergence === 'Score/confidence conflict') {
        items.push({
          id: `${row.id}-conflict`,
          row,
          severity: 'HIGH',
          title: `${row.tokenSymbol} score is strong but confidence is weak`,
          type: 'CONFLICT',
        });
      }

      if (row.action === 'SELL') {
        items.push({
          id: `${row.id}-sell`,
          row,
          severity: 'MEDIUM',
          title: `${row.tokenSymbol} has an active SELL signal`,
          type: 'SELL',
        });
      }

      if (row.action === 'HOLD' && Math.abs(row.signalScore) > 1) {
        items.push({
          id: `${row.id}-hold-strength`,
          row,
          severity: 'MEDIUM',
          title: `${row.tokenSymbol} has strong score but remains HOLD`,
          type: 'HOLD_STRENGTH',
        });
      }

      if (row.confidence < 45) {
        items.push({
          id: `${row.id}-low-confidence`,
          row,
          severity: 'LOW',
          title: `${row.tokenSymbol} confidence is below action threshold`,
          type: 'LOW_CONFIDENCE',
        });
      }

      if (expiresInHours !== null && expiresInHours > 0 && expiresInHours <= 6) {
        items.push({
          id: `${row.id}-expiring`,
          row,
          severity: 'LOW',
          title: `${row.tokenSymbol} signal expires soon`,
          type: 'EXPIRING',
        });
      }

      return items;
    }).filter((alert) => !dismissedIds.has(alert.id));
  }, [dismissedIds, rows]);

  const groupedAlerts = useMemo(() => {
    return {
      high: alerts.filter((alert) => alert.severity === 'HIGH'),
      medium: alerts.filter((alert) => alert.severity === 'MEDIUM'),
      low: alerts.filter((alert) => alert.severity === 'LOW'),
    };
  }, [alerts]);

  const dismissAlert = (id: string) => {
    setDismissedIds((current) => new Set([...current, id]));
  };

  const renderAlert = (alert: AlertItem) => (
    <div key={alert.id} className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${severityTone(alert.severity)}`}>
              {alert.severity}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{typeLabel(alert.type)}</span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-white">{alert.title}</h3>
          <p className="mt-1 text-sm text-slate-400 line-clamp-2">{alert.row.rationaleSummary}</p>

          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <span className="font-mono text-cyan-300">Score {alert.row.signalScore.toFixed(2)}</span>
            <span className="font-mono text-green-300">{alert.row.confidence}% confidence</span>
            <span className="text-slate-500">Expires {formatTime(alert.row.expiresAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap lg:flex-col gap-2 lg:min-w-[150px]">
          <button
            onClick={() => router.push(`/proposal/${alert.row.id}`)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
          >
            View Signal <ArrowRight className="h-3 w-3" />
          </button>
          <button
            onClick={() => router.push(`/tokens/${alert.row.tokenSymbol}`)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:border-cyan-500/30 transition-colors"
          >
            Token
          </button>
          <button
            onClick={() => dismissAlert(alert.id)}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
          >
            <EyeOff className="h-3 w-3" /> Dismiss
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-amber-400 font-bold mb-2">Anomaly Center</p>
            <h1 className="text-4xl font-bold gradient-text">Alerts</h1>
            <p className="text-slate-400 mt-2 max-w-2xl">
              Risk interrupts that should pull the user back into signal, token, or position review before acting late.
            </p>
          </div>
          <button
            onClick={() => router.push('/positions')}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
          >
            Review Positions <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <div className="glass-card rounded-xl p-8 border border-red-500/30 text-red-300">{error}</div>
        ) : loading ? (
          <div className="glass-card rounded-xl p-8 text-slate-500">Loading alerts...</div>
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Active alerts', value: alerts.length, icon: Bell, tone: alerts.length ? 'text-amber-300' : 'text-slate-400' },
                { label: 'High severity', value: groupedAlerts.high.length, icon: ShieldAlert, tone: groupedAlerts.high.length ? 'text-red-300' : 'text-slate-400' },
                { label: 'Sell signals', value: alerts.filter((alert) => alert.type === 'SELL').length, icon: TrendingDown, tone: 'text-red-300' },
                { label: 'Expiring', value: alerts.filter((alert) => alert.type === 'EXPIRING').length, icon: Clock, tone: 'text-cyan-300' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="glass-card rounded-xl border border-white/5 bg-black/40 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.label}</p>
                      <Icon className={`h-4 w-4 ${item.tone}`} />
                    </div>
                    <p className={`mt-3 text-2xl font-bold ${item.tone}`}>{item.value}</p>
                  </div>
                );
              })}
            </section>

            {alerts.length === 0 ? (
              <div className="glass-card rounded-xl p-12 border border-dashed border-white/10 text-center">
                <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-slate-600" />
                <h2 className="text-xl font-bold text-white">No active risk interrupts</h2>
                <p className="mt-2 text-sm text-slate-500">Signals are currently clear of configured anomaly triggers.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {[
                  { title: 'High Severity', icon: ShieldAlert, rows: groupedAlerts.high },
                  { title: 'Needs Review', icon: Zap, rows: groupedAlerts.medium },
                  { title: 'Timing / Confidence', icon: Clock, rows: groupedAlerts.low },
                ].map((group) => {
                  const Icon = group.icon;
                  if (group.rows.length === 0) return null;
                  return (
                    <section key={group.title} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-amber-300" />
                        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">{group.title}</h2>
                      </div>
                      <div className="space-y-3">{group.rows.map(renderAlert)}</div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
