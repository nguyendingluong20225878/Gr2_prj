'use client';

import Link from 'next/link';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useNdlData } from '@/lib/hooks/useNdlData';
import { formatVietnameseDateTime } from '@/lib/utils/time';
import { formatNumber } from '@/lib/utils/formatters';

export default function ModelHealthPage() {
  const { modelHealth } = useNdlData();
  const data = modelHealth.data;
  const health = getModelHealthVerdict(data);

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Sức khỏe mô hình"
          title="Tôi có nên tin hệ thống không?"
          description="Tóm tắt trạng thái model, lần cập nhật và backtest gần nhất trước khi xem chi tiết kỹ thuật."
          actions={
            <>
              <Button onClick={() => modelHealth.mutate()} variant="outline" className="border-cyan-500/30 text-cyan-300">Làm mới</Button>
              <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white"><Link href="/overview">Về tổng quan</Link></Button>
            </>
          }
        />

        {modelHealth.isLoading ? (
          <DataSkeleton rows={3} />
        ) : modelHealth.error ? (
          <EmptyState title="Không tải được sức khỏe mô hình" description={modelHealth.error.message} />
        ) : (
          <>
            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Sức khỏe mô hình</p>
              <h2 className={`mt-3 text-3xl font-black ${health.className}`}>{health.label}</h2>
              <p className="mt-2 text-sm text-slate-400">{health.reason}</p>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <Panel title="Trạng thái model">
                <Mini label="Status" value={data?.activeConfig?.status ?? 'N/A'} />
                <Mini label="Cập nhật gần nhất" value={formatVietnameseDateTime(data?.activeConfig?.updatedAt)} />
                <Mini label="Promoted at" value={formatVietnameseDateTime(data?.activeConfig?.promotedAt)} />
              </Panel>

              <Panel title="Backtest gần nhất">
                <Mini label="Status" value={translateBacktestStatus(data?.latestBacktestRun?.status)} />
                <Mini label="Started at" value={formatVietnameseDateTime(data?.latestBacktestRun?.startedAt)} />
                <Mini label="Ended at" value={formatVietnameseDateTime(data?.latestBacktestRun?.endedAt)} />
              </Panel>

              <Panel title="Tín hiệu vận hành">
                <Mini label="Latency" value={`${formatNumber(data?.latencyMs, 0)} ms`} />
                <Mini label="Metrics" value={summarizeMetrics(data?.activeConfig?.metrics ?? data?.latestBacktestRun?.metrics)} />
                <Mini label="Gợi ý đọc" value={health.advice} />
              </Panel>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Chi tiết kỹ thuật</h2>
              <p className="mt-1 text-sm text-slate-500">Dành cho debug/tuning model, không phải phần quyết định chính.</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <JsonBlock title="Active config params" value={data?.activeConfig?.params} />
                <JsonBlock title="Active config metrics" value={data?.activeConfig?.metrics} />
                <JsonBlock title="Train window" value={data?.latestBacktestRun?.trainWindow} />
                <JsonBlock title="Validation window" value={data?.latestBacktestRun?.validationWindow} />
                <JsonBlock title="Backtest metrics" value={data?.latestBacktestRun?.metrics} />
              </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function getModelHealthVerdict(data: ReturnType<typeof useNdlData>['modelHealth']['data']) {
  const active = String(data?.activeConfig?.status ?? '').toUpperCase() === 'ACTIVE';
  const runStatus = String(data?.latestBacktestRun?.status ?? '').toUpperCase();
  const hasMetrics = Boolean(Object.keys(data?.activeConfig?.metrics ?? data?.latestBacktestRun?.metrics ?? {}).length);

  if (!active) {
    return {
      label: 'Yếu',
      reason: 'Chưa có active config production, nên không nên xem model là nguồn tin cậy chính.',
      advice: 'Dùng khuyến nghị với mức tham khảo thấp.',
      className: 'text-red-300',
    };
  }

  if (runStatus.includes('FAIL') || runStatus.includes('ERROR')) {
    return {
      label: 'Yếu',
      reason: 'Backtest gần nhất không ổn định hoặc thất bại.',
      advice: 'Kiểm tra backtest trước khi tin signal mới.',
      className: 'text-red-300',
    };
  }

  if (!hasMetrics) {
    return {
      label: 'Trung bình',
      reason: 'Model đang active nhưng thiếu metrics để đánh giá hiệu suất.',
      advice: 'Tin ở mức vừa phải, ưu tiên proposal có confidence cao.',
      className: 'text-amber-300',
    };
  }

  return {
    label: 'Tốt',
    reason: 'Model đang active và có metrics/backtest để kiểm tra.',
    advice: 'Có thể dùng làm trust layer, vẫn cần xem confidence từng proposal.',
    className: 'text-green-300',
  };
}

function translateBacktestStatus(status?: string | null) {
  const value = String(status ?? '').toUpperCase();
  if (!value) return 'Chưa có backtest';
  if (value.includes('FAIL') || value.includes('ERROR')) return 'Hiệu suất không ổn định';
  if (value.includes('RUN')) return 'Đang chạy';
  if (value.includes('COMPLETE') || value.includes('SUCCESS')) return 'Đã hoàn tất';
  return status ?? 'Chưa có backtest';
}

function summarizeMetrics(metrics?: Record<string, unknown> | null) {
  if (!metrics || !Object.keys(metrics).length) return 'Chưa có metrics';
  const winRate = findMetric(metrics, ['winRate', 'win_rate', 'accuracy']);
  const roi = findMetric(metrics, ['roi', 'avgRoi', 'avg_roi', 'return']);
  if (winRate !== null) return `Win/accuracy ${formatNumber(winRate, 2)}`;
  if (roi !== null) return `ROI ${formatNumber(roi, 2)}`;
  return 'Có metrics kỹ thuật';
}

function findMetric(metrics: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <h2 className="mb-4 text-lg font-bold text-white">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-slate-300">
        {value ? JSON.stringify(value, null, 2) : 'Chưa có dữ liệu'}
      </pre>
    </div>
  );
}
