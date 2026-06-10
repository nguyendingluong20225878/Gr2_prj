'use client';

import Link from 'next/link';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { DataQualityBadge, DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useNdlData } from '@/lib/hooks/useNdlData';
import { formatVietnameseDateTime, formatExpiry } from '@/lib/utils/time';

export default function DataCheckPage() {
  const { portfolio, proposals, signals, modelHealth } = useNdlData();
  const latestSignal = signals.data?.[0];
  const latestProposal = proposals.data?.[0];
  const missingPrices = (portfolio.data?.holdings ?? []).filter((holding) => holding.dataQuality === 'MISSING_PRICE');

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Advanced · Trust Center"
          title="Khuyến nghị có dựa trên dữ liệu mới không?"
          description="Kiểm tra độ mới của dữ liệu ví, giá, tín hiệu và kết quả kiểm chứng trước khi ra quyết định. Đây là trang nâng cao để kiểm tra niềm tin vào dữ liệu."
          actions={
            <>
              <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white"><Link href="/recommendations">Dữ liệu ổn</Link></Button>
              <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300"><Link href="/model-health">Xem độ tin cậy hệ thống</Link></Button>
            </>
          }
        />

        {portfolio.isLoading || proposals.isLoading || signals.isLoading || modelHealth.isLoading ? (
          <DataSkeleton rows={4} />
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-3">
              <Panel title="Ví và giá">
                <Mini label="Thời điểm đồng bộ ví" value="Chưa có dữ liệu thời gian đồng bộ" />
                <Mini label="Token thiếu giá" value={missingPrices.length} />
                <div className="space-y-2">
                  {(portfolio.data?.holdings ?? []).slice(0, 6).map((holding) => (
                    <div key={holding.symbol} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/40 px-3 py-2">
                      <span className="text-sm text-slate-300">{holding.symbol}</span>
                      <DataQualityBadge value={holding.dataQuality} />
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Tín hiệu mới nhất">
                {latestSignal ? (
                  <>
                    <Mini label="Token" value={latestSignal.tokenSymbol ?? 'Token chưa định danh'} />
                    <Mini label="Phát hiện lúc" value={formatVietnameseDateTime(latestSignal.detectedAt)} />
                    <Mini label="Hết hiệu lực lúc" value={formatVietnameseDateTime(latestSignal.expiresAt)} />
                    <Mini label="Thời gian còn lại" value={formatExpiry(latestSignal.expiresAt)} />
                    <Mini label="Bối cảnh dữ liệu" value={latestSignal.metadata?.isNewToken ? 'Token còn ít lịch sử' : 'Có dữ liệu so sánh'} />
                    <Mini label="Chất lượng dữ liệu" value={latestSignal.metadata?.sampleSize === null || latestSignal.metadata?.sampleSize === undefined ? 'Chưa có cỡ mẫu' : `Cỡ mẫu ${latestSignal.metadata.sampleSize}`} />
                  </>
                ) : <EmptyState title="Chưa có tín hiệu" />}
              </Panel>

              <Panel title="Khuyến nghị và kiểm chứng">
                {latestProposal ? (
                  <>
                    <Mini label="Token" value={latestProposal.tokenSymbol ?? 'Token chưa định danh'} />
                    <Mini label="Tạo lúc" value={formatVietnameseDateTime(latestProposal.createdAt)} />
                    <Mini label="Hết hiệu lực lúc" value={formatVietnameseDateTime(latestProposal.expiresAt)} />
                    <Mini label="Kiểm chứng lúc" value={formatVietnameseDateTime(latestProposal.backtestedAt)} />
                    <Mini label="Chất lượng kiểm chứng" value={latestProposal.backtestMeta?.dataQuality ?? 'Chưa có dữ liệu'} />
                  </>
                ) : <EmptyState title="Chưa có khuyến nghị" />}
              </Panel>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Độ tin cậy hệ thống</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Mini label="Trạng thái" value={toTrustStatusLabel(modelHealth.data?.activeConfig?.status)} />
                <Mini label="Cập nhật lúc" value={formatVietnameseDateTime(modelHealth.data?.activeConfig?.updatedAt)} />
                <Mini label="Kích hoạt lúc" value={formatVietnameseDateTime(modelHealth.data?.activeConfig?.promotedAt)} />
                <Mini label="Độ trễ" value={modelHealth.data?.latencyMs === null || modelHealth.data?.latencyMs === undefined ? 'Chưa có dữ liệu' : `${modelHealth.data.latencyMs} ms`} />
              </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function toTrustStatusLabel(status?: string | null) {
  const normalized = String(status ?? '').toUpperCase();
  if (!normalized) return 'Chưa có dữ liệu';
  if (['ACTIVE', 'PROMOTED', 'READY', 'OK', 'HEALTHY'].includes(normalized)) return 'Đang dùng được';
  if (['TRAINING', 'PENDING', 'WARMING_UP'].includes(normalized)) return 'Đang cập nhật';
  if (['DEGRADED', 'STALE', 'LIMITED'].includes(normalized)) return 'Cần thận trọng';
  if (['FAILED', 'ERROR', 'DISABLED'].includes(normalized)) return 'Không nên dựa vào';
  return 'Cần kiểm tra thêm';
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
