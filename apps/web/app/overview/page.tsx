'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Clock,
  LineChart,
  Radar,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { RegimeStatus } from '@/app/components/analytics/RegimeStatus';
import { Skeleton } from '@/app/components/ui/skeleton';
import { useSignalAnalytics } from '@/lib/hooks/useSignalAnalytics';
import type { SignalAnalyticsRow } from '@/lib/types/analytics';
import { decisionStateMeta, getDecisionState } from '@/app/components/analytics/decisionState';

function formatTime(value?: string) {
  if (!value) return 'Chưa có tín hiệu mới';
  return new Date(value).toLocaleString('vi-VN', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function actionTone(action: SignalAnalyticsRow['action']) {
  if (action === 'BUY') return 'bg-green-500/10 text-green-300 border-green-500/20';
  if (action === 'SELL') return 'bg-red-500/10 text-red-300 border-red-500/20';
  return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
}

function scoreTone(value: number) {
  if (value > 0) return 'text-green-300';
  if (value < 0) return 'text-red-300';
  return 'text-slate-300';
}

function SignalRow({
  row,
  onOpen,
  reason,
}: {
  row: SignalAnalyticsRow;
  onOpen: (id: string) => void;
  reason?: string;
}) {
  const decisionState = decisionStateMeta(getDecisionState(row));

  return (
    <button
      onClick={() => onOpen(row.id)}
      className="w-full text-left rounded-xl border border-white/5 bg-black/40 p-4 hover:border-cyan-500/30 hover:bg-white/[0.03] transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-white">{row.tokenSymbol}</span>
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${actionTone(row.action)}`}>
              {row.action}
            </span>
            <span className="text-[10px] text-slate-500">#{row.rank}</span>
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${decisionState.className}`}>
              {decisionState.label}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-300 line-clamp-2">{reason || row.rationaleSummary}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-mono text-sm font-bold ${scoreTone(row.signalScore)}`}>
            {row.signalScore > 0 ? '+' : ''}
            {row.signalScore.toFixed(2)}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">{row.confidence}% tin cậy</p>
        </div>
      </div>
    </button>
  );
}

function DecisionQueueSummary({
  counts,
  onOpen,
}: {
  counts: {
    conflictRisk: number;
    ready: number;
    wait: number;
  };
  onOpen: (state: 'ready' | 'conflict' | 'risk' | 'wait') => void;
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {[
        {
          label: 'Ready',
          value: counts.ready,
          hint: 'Có thể đánh giá lệnh ngay',
          state: 'ready' as const,
          tone: 'border-green-500/30 bg-green-500/10 text-green-300',
        },
        {
          label: 'Validation / Risk',
          value: counts.conflictRisk,
          hint: 'Cần kiểm chứng trước khi vào lệnh',
          state: 'conflict' as const,
          tone: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
        },
        {
          label: 'Wait',
          value: counts.wait,
          hint: 'Chưa đủ điều kiện hành động',
          state: 'wait' as const,
          tone: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
        },
      ].map((item) => (
        <button
          key={item.label}
          onClick={() => onOpen(item.state)}
          className={`glass-card rounded-xl border p-4 text-left transition-colors hover:bg-white/[0.03] ${item.tone}`}
        >
          <p className="text-[10px] uppercase tracking-widest font-bold">{item.label}</p>
          <p className="mt-2 text-3xl font-black">{item.value}</p>
          <p className="mt-1 text-xs text-slate-400">{item.hint}</p>
        </button>
      ))}
    </section>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const { demoReason, isDemoMode, lastUpdatedAt, rows, summary, loading, error } = useSignalAnalytics();

  const overview = useMemo(() => {
    const now = Date.now();
    const expiringWindowMs = 24 * 60 * 60 * 1000;
    const actionableRows = rows.filter((row) => row.action !== 'HOLD');
    const strongestSignals = actionableRows
      .filter((row) => row.signalScore > 0)
      .slice(0, 3);
    const riskSignals = rows
      .filter((row) => row.divergence !== 'None' || row.action === 'SELL' || row.semantics?.uncertainty?.severity === 'HIGH' || row.semantics?.volatility.severity === 'HIGH')
      .slice(0, 3);
    const expiringSoon = [...rows]
      .filter((row) => {
        if (!row.expiresAt) return false;
        const expiresAt = new Date(row.expiresAt).getTime();
        return Number.isFinite(expiresAt) && expiresAt > now && expiresAt <= now + expiringWindowMs;
      })
      .sort((a, b) => new Date(a.expiresAt || 0).getTime() - new Date(b.expiresAt || 0).getTime())
      .slice(0, 2);

    return {
      decisionCounts: rows.reduce(
        (acc, row) => {
          const state = getDecisionState(row);
          if (state === 'ready') acc.ready += 1;
          else if (state === 'wait') acc.wait += 1;
          else acc.conflictRisk += 1;
          return acc;
        },
        { conflictRisk: 0, ready: 0, wait: 0 }
      ),
      strongestSignals,
      riskSignals,
      expiringSoon,
    };
  }, [rows]);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-bold mb-2">Tổng Quan</p>
            <h1 className="text-4xl font-bold gradient-text">Trung tâm Chỉ huy Thị trường</h1>
            <p className="text-slate-400 mt-2 max-w-2xl">
              Bắt đầu tại đây để theo dõi các cơ hội đáng chú ý, nhận diện rủi ro và đưa ra quyết định giao dịch tiếp theo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push('/signals')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-cyan-500 transition-all"
            >
              Đánh giá lệnh <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push('/alerts')}
              className="glass-card inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 px-4 py-3 text-sm font-bold text-cyan-300 hover:bg-cyan-500/10 transition-colors"
            >
              Xử lý rủi ro
            </button>
          </div>
        </div>

        {isDemoMode && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Demo mode active: using cached scenario data{demoReason ? ` (${demoReason})` : ''}. Last refresh{' '}
            {lastUpdatedAt ? formatTime(lastUpdatedAt) : 'n/a'}.
          </div>
        )}

        {error ? (
          <div className="glass-card rounded-xl p-8 border border-red-500/30 text-red-300">
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/15 transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="glass-card rounded-xl p-6 lg:col-span-2 space-y-4">
              <Skeleton className="h-5 w-48 bg-white/10" />
              <Skeleton className="h-24 w-full bg-white/10" />
              <Skeleton className="h-24 w-full bg-white/10" />
            </div>
            <div className="glass-card rounded-xl p-6 space-y-4">
              <Skeleton className="h-5 w-36 bg-white/10" />
              <Skeleton className="h-32 w-full bg-white/10" />
            </div>
          </div>
        ) : (
          <>
            <RegimeStatus summary={summary} />

            <DecisionQueueSummary
              counts={overview.decisionCounts}
              onOpen={(state) => router.push(state === 'conflict' ? '/signals?decision=conflict' : `/signals?decision=${state}`)}
            />

            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Tổng tín hiệu', value: summary.totalSignals, hint: 'hôm nay', icon: BarChart3 },
                { label: 'Mua (Buy)', value: summary.buyCount, hint: 'cơ hội', icon: TrendingUp },
                { label: 'Bán (Sell)', value: summary.sellCount, hint: 'phòng vệ/rủi ro', icon: AlertTriangle },
                { label: 'Giữ (Hold)', value: summary.holdCount, hint: 'quan sát', icon: ShieldCheck },
                { label: 'Cập nhật lúc', value: formatTime(summary.lastUpdated), hint: 'tín hiệu mới nhất', icon: Clock },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="glass-card rounded-xl border border-white/5 bg-black/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.label}</p>
                      <Icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <p className="mt-3 text-xl font-bold text-white">{item.value}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
                  </div>
                );
              })}
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
              <div className="space-y-6">
                <section className="glass-card rounded-xl border border-white/5 p-5 bg-black/20">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Tín hiệu nên đánh giá ngay</h2>
                      <p className="text-xs text-slate-500 mt-1">Các tín hiệu BUY/SELL có điểm mạnh nhất, dùng để mở proposal và quyết định có theo lệnh hay không.</p>
                    </div>
                    <button
                      onClick={() => router.push('/signals')}
                      className="text-xs font-bold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
                    >
                      Xem danh sách tín hiệu <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {overview.strongestSignals.length ? (
                    <div className="space-y-3">
                      {overview.strongestSignals.map((row) => (
                        <SignalRow key={row.id} row={row} onOpen={(id) => router.push(`/proposal/${id}`)} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-8 text-center">
                      <p className="text-slate-500">Không có tín hiệu MUA nào khả thi trong tệp tín hiệu hiện tại.</p>
                      <button
                        onClick={() => router.push('/signals')}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-300 hover:bg-cyan-500/15 transition-colors"
                      >
                        Xem danh sách tín hiệu <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </section>

                <section className="glass-card rounded-xl border border-white/5 p-5 bg-black/20">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Tín hiệu cần kiểm chứng</h2>
                      <p className="text-xs text-slate-500 mt-1">Các tín hiệu có backtest xấu, biến động cao, dữ liệu yếu hoặc dấu hiệu rủi ro cần xem kỹ trước khi vào lệnh.</p>
                    </div>
                    <button
                      onClick={() => router.push('/alerts')}
                      className="text-xs font-bold text-amber-300 hover:text-amber-200 inline-flex items-center gap-1"
                    >
                      Xử lý rủi ro <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {overview.riskSignals.length ? (
                    <div className="space-y-3">
                      {overview.riskSignals.map((row) => (
                        <SignalRow
                          key={row.id}
                          row={row}
                          reason={row.divergence !== 'None' ? row.divergence : row.rationaleSummary}
                          onOpen={(id) => router.push(`/proposal/${id}`)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-8 text-center text-slate-500">
                      Không phát hiện sự bất thường nào đáng chú ý.
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-4">
                <section className="glass-card rounded-xl border border-white/5 p-5 bg-black/20">
                  <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Sắp Hết Hạn</h2>
                  <div className="mt-4 space-y-3">
                    {overview.expiringSoon.length ? overview.expiringSoon.map((row) => (
                      <button
                        key={row.id}
                        onClick={() => router.push(`/proposal/${row.id}`)}
                        className="w-full rounded-xl border border-white/5 bg-black/40 p-3 text-left hover:border-cyan-500/30 hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold text-white">{row.tokenSymbol}</span>
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${actionTone(row.action)}`}>
                            {row.action}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{formatTime(row.expiresAt)}</p>
                      </button>
                    )) : (
                      <p className="rounded-xl border border-dashed border-white/10 bg-black/30 p-4 text-sm text-slate-500">
                        Không có tín hiệu nào sắp hết hạn.
                      </p>
                    )}
                  </div>
                </section>

                <section className="glass-card rounded-xl border border-white/5 p-5 bg-black/20">
                  <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Hành Động Tiếp Theo</h2>
                  <div className="mt-4 grid gap-2">
                    {[
                      { label: 'Không gian tín hiệu', path: '/signals', icon: BarChart3 },
                      { label: 'Theo dõi Alpha hằng ngày', path: '/signals/daily', icon: Radar },
                      { label: 'Xử lý rủi ro', path: '/alerts', icon: Bell },
                      { label: 'Vị thế đang mở', path: '/positions', icon: LineChart },
                      { label: 'Tổng quan danh mục', path: '/portfolio', icon: Wallet },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.path}
                          onClick={() => router.push(item.path)}
                          className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 px-3 py-3 text-left text-sm text-slate-300 hover:text-white hover:border-cyan-500/30 hover:bg-white/[0.03] transition-colors"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Icon className="w-4 h-4 text-cyan-400" />
                            {item.label}
                          </span>
                          <ArrowRight className="w-4 h-4 text-slate-600" />
                        </button>
                      );
                    })}
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
