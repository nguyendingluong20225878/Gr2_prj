'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  GitCompareArrows,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  Waves,
} from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { useSignalAnalytics } from '@/lib/hooks/useSignalAnalytics';
import type { SignalAnalyticsRow } from '@/lib/types/analytics';
import { useTradingDemoStore } from '@/app/contexts/TradingDemoContext';

type AlertSeverity = 'HIGH' | 'MEDIUM' | 'LOW';
type AlertCause = 'L2_L3_CONFLICT' | 'MARKET_VOLATILITY' | 'SENTIMENT_UNCERTAINTY' | 'POSITION_RISK' | 'SIGNAL_FRESHNESS' | 'LOW_CONFIDENCE' | 'DEMO_POSITION';
type AlertStatus = 'ALL' | 'CRITICAL' | 'ACKNOWLEDGED';

type RiskAlert = {
  cause: AlertCause;
  ctaHref: string;
  ctaLabel: string;
  detail: string;
  id: string;
  positionId?: string;
  proposalId?: string;
  row?: SignalAnalyticsRow;
  severity: AlertSeverity;
  status?: 'new' | 'acknowledged' | 'resolved';
  title: string;
  tokenSymbol?: string;
};

const severityOrder: Record<AlertSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function formatTime(value?: string) {
  if (!value) return 'No expiry';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function severityTone(severity: AlertSeverity) {
  if (severity === 'HIGH') return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (severity === 'MEDIUM') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
}

function causeLabel(cause: AlertCause) {
  const labels: Record<AlertCause, string> = {
    L2_L3_CONFLICT: 'L2/L3 Conflict',
    LOW_CONFIDENCE: 'Low Confidence',
    DEMO_POSITION: 'Mock Position',
    POSITION_RISK: 'Position Risk',
    SIGNAL_FRESHNESS: 'Freshness Risk',
    MARKET_VOLATILITY: 'Market Volatility',
    SENTIMENT_UNCERTAINTY: 'Sentiment Uncertainty',
  };
  return labels[cause];
}

function causeIcon(cause: AlertCause) {
  if (cause === 'L2_L3_CONFLICT') return GitCompareArrows;
  if (cause === 'MARKET_VOLATILITY' || cause === 'SENTIMENT_UNCERTAINTY') return Waves;
  if (cause === 'POSITION_RISK') return TrendingDown;
  if (cause === 'DEMO_POSITION') return ShieldAlert;
  if (cause === 'SIGNAL_FRESHNESS') return Clock;
  return AlertTriangle;
}

function buildAlerts(rows: SignalAnalyticsRow[]) {
  const now = Date.now();

  return rows.flatMap((row) => {
    const proposalHref = `/proposal/${row.proposalId || row.id}`;
    const items: RiskAlert[] = [];
    const expiresInHours = row.expiresAt ? (new Date(row.expiresAt).getTime() - now) / 36e5 : null;
    const detectedAgeHours = row.detectedAt ? (now - new Date(row.detectedAt).getTime()) / 36e5 : null;

    if (row.realizedVolatility !== null && row.realizedVolatility !== undefined && row.realizedVolatility > 0.5) {
      items.push({
        cause: 'MARKET_VOLATILITY',
        ctaHref: proposalHref,
        ctaLabel: 'Inspect signal',
        detail: `Realized volatility ${row.realizedVolatility.toFixed(2)} vượt ngưỡng demo. Nên giảm size hoặc WAIT.`,
        id: `${row.id}-volatility`,
        row,
        severity: 'HIGH',
        title: `${row.tokenSymbol}: Biến động bất thường`,
      });
    }

    if (row.uncertaintyEntropy !== null && row.uncertaintyEntropy !== undefined && row.uncertaintyEntropy > 0.82) {
      items.push({
        cause: 'SENTIMENT_UNCERTAINTY',
        ctaHref: proposalHref,
        ctaLabel: 'Review evidence',
        detail: `Sentiment uncertainty ${row.uncertaintyEntropy.toFixed(2)} cao. Nên kiểm tra nguồn và ưu tiên WAIT nếu bằng chứng không rõ.`,
        id: `${row.id}-uncertainty`,
        row,
        severity: 'MEDIUM',
        title: `${row.tokenSymbol}: Sentiment chưa đủ chắc chắn`,
      });
    }

    if (row.backtest?.outcome === 'LOSS' || row.action === 'SELL') {
      const net = row.backtest?.netPnlPct;
      items.push({
        cause: 'POSITION_RISK',
        ctaHref: '/positions',
        ctaLabel: 'Review positions',
        detail: row.backtest?.outcome === 'LOSS'
          ? `Replay theo rule demo đang lỗ ${net !== null && net !== undefined ? `${net.toFixed(2)}%` : 'n/a'}. Kiểm tra vị thế mở liên quan.`
          : 'SELL signal có thể ảnh hưởng vị thế đang mở. Ưu tiên kiểm tra lifecycle position.',
        id: `${row.id}-position-risk`,
        row,
        severity: row.backtest?.outcome === 'LOSS' ? 'HIGH' : 'MEDIUM',
        title: `${row.tokenSymbol}: Rủi ro vị thế cần xử lý`,
      });
    }

    if ((expiresInHours !== null && expiresInHours > 0 && expiresInHours <= 6) || (detectedAgeHours !== null && detectedAgeHours >= 24)) {
      items.push({
        cause: 'SIGNAL_FRESHNESS',
        ctaHref: proposalHref,
        ctaLabel: 'Check freshness',
        detail: expiresInHours !== null && expiresInHours <= 6
          ? `Signal hết hạn lúc ${formatTime(row.expiresAt)}. Không nên ENTER nếu chưa refresh dữ liệu.`
          : `Signal được phát hiện hơn ${Math.floor(detectedAgeHours || 0)} giờ trước. Cần stale-state warning.`,
        id: `${row.id}-freshness`,
        row,
        severity: 'LOW',
        title: `${row.tokenSymbol}: Dữ liệu có nguy cơ cũ`,
      });
    }

    if (row.confidence < 45) {
      items.push({
        cause: 'LOW_CONFIDENCE',
        ctaHref: proposalHref,
        ctaLabel: 'Review evidence',
        detail: `Confidence chỉ ${row.confidence}%, thấp hơn ngưỡng hành động demo. Đây là tín hiệu nên WAIT hoặc REJECT.`,
        id: `${row.id}-low-confidence`,
        row,
        severity: 'LOW',
        title: `${row.tokenSymbol}: Độ tin cậy thấp`,
      });
    }

    return items;
  }).sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export default function AlertsPage() {
  const router = useRouter();
  const { demoReason, isDemoMode, lastUpdatedAt, rows, loading, error, refetch } = useSignalAnalytics();
  const { acknowledgeAlert, alerts: demoAlerts, resolveAlert } = useTradingDemoStore();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<AlertStatus>('ALL');

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const lifecycleAlerts = useMemo<RiskAlert[]>(() => {
    return demoAlerts.map((alert) => ({
      cause: 'DEMO_POSITION',
      ctaHref: alert.positionId ? '/positions' : `/proposal/${alert.proposalId || ''}`,
      ctaLabel: alert.positionId ? 'Review position' : 'Review proposal',
      detail: alert.detail,
      id: alert.id,
      positionId: alert.positionId,
      proposalId: alert.proposalId,
      severity: alert.severity,
      status: alert.status,
      title: alert.title,
      tokenSymbol: alert.tokenSymbol,
    }));
  }, [demoAlerts]);

  const allAlerts = useMemo(() => [...lifecycleAlerts, ...buildAlerts(rows)], [lifecycleAlerts, rows]);
  const visibleAlerts = useMemo(() => {
    return allAlerts.filter((alert) => {
      if (alert.status === 'resolved') return status === 'ALL';
      if (status === 'CRITICAL') return alert.severity === 'HIGH' && alert.status !== 'acknowledged' && !dismissedIds.has(alert.id);
      if (status === 'ACKNOWLEDGED') return alert.status === 'acknowledged' || dismissedIds.has(alert.id);
      return !dismissedIds.has(alert.id);
    });
  }, [allAlerts, dismissedIds, status]);

  const grouped = useMemo(() => ({
    high: visibleAlerts.filter((alert) => alert.severity === 'HIGH'),
    medium: visibleAlerts.filter((alert) => alert.severity === 'MEDIUM'),
    low: visibleAlerts.filter((alert) => alert.severity === 'LOW'),
  }), [visibleAlerts]);

  const causeCounts = useMemo(() => ({
    volatility: allAlerts.filter((alert) => (alert.cause === 'MARKET_VOLATILITY' || alert.cause === 'SENTIMENT_UNCERTAINTY') && !dismissedIds.has(alert.id)).length,
    positions: allAlerts.filter((alert) => (alert.cause === 'POSITION_RISK' || alert.cause === 'DEMO_POSITION') && alert.status !== 'resolved' && !dismissedIds.has(alert.id)).length,
    stale: allAlerts.filter((alert) => alert.cause === 'SIGNAL_FRESHNESS' && !dismissedIds.has(alert.id)).length,
  }), [allAlerts, dismissedIds]);

  const dismissAlert = (id: string) => {
    setDismissedIds((current) => new Set([...current, id]));
  };

  const restoreAlert = (id: string) => {
    setDismissedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const renderAlert = (alert: RiskAlert) => {
    const Icon = causeIcon(alert.cause);
    const isDismissed = dismissedIds.has(alert.id);
    const displayStatus = alert.status || (isDismissed ? 'acknowledged' : 'new');
    const proposalHref = alert.proposalId || alert.row?.proposalId || alert.row?.id;

    return (
      <article key={alert.id} className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${severityTone(alert.severity)}`}>
                {alert.severity}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <Icon className="h-3 w-3" /> {causeLabel(alert.cause)}
              </span>
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                isDismissed ? 'border-slate-500/30 bg-slate-500/10 text-slate-400' : 'border-green-500/30 bg-green-500/10 text-green-300'
              }`}>
                {displayStatus.toUpperCase()}
              </span>
            </div>

            <h3 className="mt-3 text-lg font-bold text-white">{alert.title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{alert.detail}</p>

            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <span className="font-mono text-cyan-300">Score {alert.row ? alert.row.signalScore.toFixed(2) : 'N/A'}</span>
              <span className="font-mono text-green-300">{alert.row ? `${alert.row.confidence}% confidence` : `${alert.tokenSymbol || 'TOKEN'} lifecycle`}</span>
              <span className="font-mono text-slate-300">Action {alert.row?.action || 'MONITOR'}</span>
              {alert.row?.backtest?.netPnlPct !== null && alert.row?.backtest?.netPnlPct !== undefined && (
                <span className={alert.row.backtest.netPnlPct >= 0 ? 'font-mono text-green-300' : 'font-mono text-red-300'}>
                  Replay {alert.row.backtest.netPnlPct.toFixed(2)}%
                </span>
              )}
              <span className="text-slate-500">Expires {alert.row ? formatTime(alert.row.expiresAt) : 'N/A'}</span>
            </div>
          </div>

          <div className="flex flex-wrap lg:flex-col gap-2 lg:min-w-[160px]">
            <button
              onClick={() => router.push(alert.ctaHref)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
            >
              {alert.ctaLabel} <ArrowRight className="h-3 w-3" />
            </button>
            <button
              onClick={() => proposalHref ? router.push(`/proposal/${proposalHref}`) : router.push('/positions')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:border-cyan-500/30 transition-colors"
            >
              <Eye className="h-3 w-3" /> Proposal
            </button>
            <button
              onClick={() => {
                if (alert.status) acknowledgeAlert(alert.id);
                else if (isDismissed) restoreAlert(alert.id);
                else dismissAlert(alert.id);
              }}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
            >
              {displayStatus === 'acknowledged' ? <CheckCircle2 className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {displayStatus === 'acknowledged' ? 'Acknowledged' : 'Acknowledge'}
            </button>
            {alert.status && alert.status !== 'resolved' && (
              <button
                onClick={() => resolveAlert(alert.id)}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-bold text-green-300 hover:bg-green-500/15 transition-colors"
              >
                Resolve
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-amber-400 font-bold mb-2">Risk Command Center</p>
            <h1 className="text-4xl font-bold gradient-text">Alerts</h1>
            <p className="text-slate-400 mt-2 max-w-2xl">
              Trung tâm ngắt rủi ro cho demo decision flow: volatility, position risk và stale data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-200 hover:bg-cyan-500/15 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => router.push('/positions')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
            >
              Review Positions <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isDemoMode && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Demo mode active: risk center is using cached scenario data{demoReason ? ` (${demoReason})` : ''}. Last refresh{' '}
            {lastUpdatedAt ? formatTime(lastUpdatedAt) : 'n/a'}.
          </div>
        )}

        {error ? (
          <div className="glass-card rounded-xl p-8 border border-red-500/30 text-red-300">
            <p>{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/15 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="glass-card rounded-xl p-8 text-slate-500">Loading risk center...</div>
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: 'Volatility', value: causeCounts.volatility, icon: Waves, tone: causeCounts.volatility ? 'text-amber-300' : 'text-slate-400' },
                { label: 'Position risk', value: causeCounts.positions, icon: TrendingDown, tone: causeCounts.positions ? 'text-red-300' : 'text-slate-400' },
                { label: 'Freshness', value: causeCounts.stale, icon: Clock, tone: causeCounts.stale ? 'text-cyan-300' : 'text-slate-400' },
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

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1">
                {(['ALL', 'CRITICAL', 'ACKNOWLEDGED'] as AlertStatus[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => setStatus(item)}
                    className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                      status === item ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Bell className="h-4 w-4" />
                {allAlerts.filter((alert) => alert.status !== 'resolved' && !dismissedIds.has(alert.id)).length} active / {allAlerts.filter((alert) => alert.status === 'acknowledged' || dismissedIds.has(alert.id)).length} acknowledged
              </div>
            </div>

            {visibleAlerts.length === 0 ? (
              <div className="glass-card rounded-xl p-12 border border-dashed border-white/10 text-center">
                <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-slate-600" />
                <h2 className="text-xl font-bold text-white">
                  {status === 'CRITICAL' ? 'No critical risk interrupts' : status === 'ACKNOWLEDGED' ? 'No acknowledged alerts' : 'No risk interrupts'}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {status === 'CRITICAL'
                    ? 'Signal flow hiện không có cảnh báo high severity theo rule demo đã cấu hình.'
                    : 'Các alert đã acknowledge sẽ nằm ở đây để audit lại quyết định.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {[
                  { title: 'High Severity', icon: ShieldAlert, rows: grouped.high },
                  { title: 'Medium Severity', icon: AlertTriangle, rows: grouped.medium },
                  { title: 'Low Severity', icon: Clock, rows: grouped.low },
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
