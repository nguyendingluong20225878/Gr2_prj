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
import { useSignalAnalytics } from '@/lib/hooks/useSignalAnalytics';
import type { SignalAnalyticsRow } from '@/lib/types/analytics';

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

export default function OverviewPage() {
  const router = useRouter();
  const { rows, summary, loading, error } = useSignalAnalytics();

  const overview = useMemo(() => {
    const actionableRows = rows.filter((row) => row.action !== 'HOLD');
    const strongestSignals = actionableRows
      .filter((row) => row.signalScore > 0)
      .slice(0, 3);
    const riskSignals = rows
      .filter((row) => row.divergence !== 'None' || row.action === 'SELL' || (row.volatilityFlag !== null && row.volatilityFlag > 0.82))
      .slice(0, 3);
    const strongestMomentum = [...rows]
      .filter((row) => row.momentumAcceleration !== null)
      .sort((a, b) => Number(b.momentumAcceleration ?? -Infinity) - Number(a.momentumAcceleration ?? -Infinity))[0];
    const expiringSoon = [...rows]
      .filter((row) => row.expiresAt)
      .sort((a, b) => new Date(a.expiresAt || 0).getTime() - new Date(b.expiresAt || 0).getTime())
      .slice(0, 2);

    return {
      strongestSignals,
      riskSignals,
      strongestMomentum,
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
              Xem Tín Hiệu <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push('/alerts')}
              className="glass-card inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 px-4 py-3 text-sm font-bold text-cyan-300 hover:bg-cyan-500/10 transition-colors"
            >
              Kiểm tra Cảnh báo
            </button>
          </div>
        </div>

        {error ? (
          <div className="glass-card rounded-xl p-8 border border-red-500/30 text-red-300">{error}</div>
        ) : loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="glass-card rounded-xl p-8 text-slate-500 lg:col-span-2">Đang tải tóm tắt thị trường...</div>
            <div className="glass-card rounded-xl p-8 text-slate-500">Đang tải dữ liệu...</div>
          </div>
        ) : (
          <>
            <RegimeStatus summary={summary} />

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
                      <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Cần Chú Ý Ngay</h2>
                      <p className="text-xs text-slate-500 mt-1">Các tín hiệu hành động mạnh được xếp hạng theo điểm tín hiệu hiện tại.</p>
                    </div>
                    <button
                      onClick={() => router.push('/signals')}
                      className="text-xs font-bold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
                    >
                      Xem tất cả <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {overview.strongestSignals.length ? (
                    <div className="space-y-3">
                      {overview.strongestSignals.map((row) => (
                        <SignalRow key={row.id} row={row} onOpen={(id) => router.push(`/proposal/${id}`)} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-8 text-center text-slate-500">
                      Không có tín hiệu MUA nào khả thi trong tệp tín hiệu hiện tại.
                    </div>
                  )}
                </section>

                <section className="glass-card rounded-xl border border-white/5 p-5 bg-black/20">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Hàng đợi Rủi ro & Bất thường</h2>
                      <p className="text-xs text-slate-500 mt-1">Xung đột, biến động bất thường và các tín hiệu phòng thủ cần được rà soát.</p>
                    </div>
                    <button
                      onClick={() => router.push('/alerts')}
                      className="text-xs font-bold text-amber-300 hover:text-amber-200 inline-flex items-center gap-1"
                    >
                      Cảnh báo <ArrowRight className="w-3 h-3" />
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
                  <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Động Lượng Đáng Chú Ý</h2>
                  {overview.strongestMomentum ? (
                    <button
                      onClick={() => router.push(`/tokens/${overview.strongestMomentum?.tokenSymbol}`)}
                      className="mt-4 w-full rounded-xl border border-white/5 bg-black/40 p-4 text-left hover:border-cyan-500/30 hover:bg-white/[0.03] transition-colors"
                    >
                      <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Gia tốc tăng mạnh nhất</p>
                      <p className="mt-2 text-2xl font-bold text-white">{overview.strongestMomentum.tokenSymbol}</p>
                      <p className="mt-1 font-mono text-green-300">
                        +{Number(overview.strongestMomentum.momentumAcceleration ?? 0).toFixed(2)}
                      </p>
                      <p className="mt-3 text-xs text-slate-500 line-clamp-2">{overview.strongestMomentum.rationaleSummary}</p>
                    </button>
                  ) : (
                    <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/30 p-4 text-sm text-slate-500">
                      Dữ liệu gia tốc động lượng hiện không khả dụng.
                    </p>
                  )}
                </section>

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
                      { label: 'Cảnh báo rủi ro', path: '/alerts', icon: Bell },
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