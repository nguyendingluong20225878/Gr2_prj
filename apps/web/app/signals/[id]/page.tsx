'use client';

import Link from 'next/link';
import type React from 'react';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { CountdownBadge, DataSkeleton, EmptyState, PageHeader, SourceList } from '@/app/components/shared/NdlUi';
import { useSignalDetail } from '@/lib/hooks/useNdlData';
import { formatNumber, toDisplayAction, toDisplaySentiment } from '@/lib/utils/formatters';
import { formatVietnameseDateTime } from '@/lib/utils/time';

export default function SignalAnalysisPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const signal = useSignalDetail(id);
  const data = signal.data;
  const scoreComponents = data?.metadata?.scoreComponents ?? data?.enrichedProposal?.scoreComponents;
  const proposalId = data?.enrichedProposal?._id;

  useEffect(() => {
    if (proposalId) {
      router.replace(`/proposal/${proposalId}`);
    }
  }, [proposalId, router]);

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Button>

        {signal.isLoading ? (
          <DataSkeleton rows={3} />
        ) : !data ? (
          <EmptyState title="Không tìm thấy tín hiệu" />
        ) : (
          proposalId ? (
            <DataSkeleton rows={2} />
          ) : (
          <>
            <PageHeader
              eyebrow="Advanced · Tín hiệu hỗ trợ"
              title={data.tokenSymbol ?? 'Token chưa định danh'}
              description="Mục này chỉ giải thích điểm tín hiệu khi chưa có khuyến nghị liên kết. Đây không phải nơi quyết định giao dịch."
              actions={
                <>
                  <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                    <Link href={`/signals/${id}/explanation`}>Xem kiểm tra điểm</Link>
                  </Button>
                </>
              }
            />

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-300" variant="outline">{toDisplayAction(data.suggestionType)}</Badge>
                <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" variant="outline">{toDisplaySentiment(data.sentimentType)}</Badge>
                <Badge className="border-white/10 bg-black/40 text-slate-300" variant="outline">{toSignalStatusLabel(data.lifecycleState ?? data.status)}</Badge>
                <CountdownBadge value={data.expiresAt} />
              </div>
              <p className="mt-4 text-base leading-relaxed text-slate-200">{data.rationaleSummary ?? data.enrichedProposal?.rationaleSummary ?? 'Chưa có luận điểm.'}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <Mini label="Điểm tín hiệu" value={(data.quantScore ?? scoreComponents?.finalScore) !== null && (data.quantScore ?? scoreComponents?.finalScore) !== undefined ? formatNumber(data.quantScore ?? scoreComponents?.finalScore, 2) : 'Chưa có dữ liệu'} />
                <Mini label="Tin cậy" value={data.confidence !== null && data.confidence !== undefined ? `${data.confidence}%` : 'Chưa có dữ liệu'} />
                <Mini label="Bối cảnh dữ liệu" value={data.metadata?.isNewToken ? 'Token còn ít lịch sử' : 'Có dữ liệu so sánh'} />
                <Mini label="Phát hiện lúc" value={formatVietnameseDateTime(data.detectedAt)} />
                <Mini label="Khuyến nghị liên kết" value="Chưa có khuyến nghị liên kết" />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Thành phần điểm</h2>
                <p className="mt-1 text-sm text-slate-500">Các thành phần này mô tả vì sao điểm tín hiệu mạnh hoặc yếu, không phải bằng chứng lợi nhuận.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Mini label="Bối cảnh thời gian" value={describeScoreComponent(scoreComponents?.timeZ, 'time')} />
                  <Mini label="So với lịch sử token" value={describeScoreComponent(scoreComponents?.pureAlphaZ, 'token')} />
                  <Mini label="So với thị trường" value={describeScoreComponent(scoreComponents?.crossZ, 'market')} />
                  <Mini label="Kết quả điểm tín hiệu" value={scoreComponents?.finalScore === null || scoreComponents?.finalScore === undefined ? 'Chưa có dữ liệu' : formatNumber(scoreComponents.finalScore, 2)} />
                  <Mini label="Đồng thuận nguồn" value={describeAgreement(data.uncertaintyEntropy ?? data.metadata?.uncertaintyEntropy)} />
                  <Mini label="Biến động thực tế" value={describeVolatility(data.realizedVolatility ?? data.metadata?.realizedVolatility)} />
                </div>
              </div>

              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Cách đọc độ tin cậy</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Độ tin cậy được tính từ độ mạnh tín hiệu, độ tin cậy nguồn, độ mới dữ liệu và mức liên quan tới tài sản. Các số chỉ là kết quả cuối, không phải bằng chứng riêng lẻ.
                </p>
                <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                  Độ tin cậy = độ mạnh tín hiệu x độ tin cậy nguồn x độ mới dữ liệu x mức liên quan
                </div>
                <div className="mt-4 space-y-2">
                  {(data.confidenceBreakdown ?? []).map((item) => (
                    <div key={item.label} className="rounded-lg border border-white/5 bg-black/40 px-3 py-2 text-sm text-slate-300">
                      {item.label} · {impactLabel(item.impact)}
                    </div>
                  ))}
                  {!data.confidenceBreakdown?.length ? <p className="text-sm text-slate-500">Chưa đủ dữ liệu để giải thích bước này.</p> : null}
                </div>
              </div>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Nguồn bằng chứng</h2>
              <div className="mt-4">
                <SourceList sources={data.sources} />
              </div>
            </section>
          </>
          )
        )}
      </div>
    </Layout>
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

function describeScoreComponent(value: number | null | undefined, type: 'time' | 'token' | 'market') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Chưa có dữ liệu';
  const abs = Math.abs(Number(value));
  if (abs >= 1.5) {
    if (type === 'time') return 'Nổi bật rõ theo thời gian';
    if (type === 'token') return 'Khác biệt rõ so với lịch sử token';
    return 'Nổi bật rõ so với thị trường';
  }
  if (abs >= 1) return 'Có tín hiệu nhưng chưa quá mạnh';
  return 'Chưa nổi bật rõ';
}

function describeAgreement(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Chưa có dữ liệu';
  return Number(value) > 0.82 ? 'Các nguồn còn phân tán' : 'Chưa thấy phân tán lớn';
}

function describeVolatility(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Chưa có dữ liệu';
  if (Number(value) > 0.5) return 'Biến động cao';
  if (Number(value) > 0.25) return 'Biến động vừa';
  return 'Biến động thấp';
}

function impactLabel(value: 'positive' | 'negative' | 'neutral') {
  if (value === 'positive') return 'làm tăng độ tin cậy';
  if (value === 'negative') return 'làm giảm độ tin cậy';
  return 'ảnh hưởng trung tính';
}

function toSignalStatusLabel(value?: string | null) {
  const status = String(value ?? '').toUpperCase();
  if (!status) return 'Đang cập nhật';
  if (status.includes('EXPIRE')) return 'Hết hiệu lực';
  if (status.includes('READY') || status.includes('ACTIVE')) return 'Có thể đọc';
  if (status.includes('PENDING')) return 'Đang chờ';
  return 'Trạng thái nâng cao';
}
