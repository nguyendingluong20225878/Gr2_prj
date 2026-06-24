'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { DataSkeleton, EmptyState, PageHeader, ProposalCard, SignalCard } from '@/app/components/shared/NdlUi';
import { useNdlData, useProposalDetail } from '@/lib/hooks/useNdlData';
import { formatConfidence, formatCurrency, formatPercent, normalizePercentValue } from '@/lib/utils/formatters';
import { isExpired } from '@/lib/utils/time';

export default function PositionMonitorPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const { portfolio, signals } = useNdlData();
  const position = portfolio.data?.investments?.find((item) => item._id === id);
  const proposal = useProposalDetail(typeof position?.proposalId === 'string' ? position.proposalId : undefined);
  const tokenSymbol = String(position?.symbol ?? position?.tokenSymbol ?? '').toUpperCase();
  const currentSignals = (signals.data ?? []).filter((signal) => String(signal.tokenSymbol ?? '').toUpperCase() === tokenSymbol);
  const latestSignal = currentSignals[0];
  const positionRoi = normalizePercentValue(position?.roi);

  const warnings = [
    proposal.data?.expiresAt && isExpired(proposal.data.expiresAt) ? 'Khuyến nghị gốc đã hết hiệu lực.' : null,
    latestSignal && Number(latestSignal.confidence ?? 0) < Number(proposal.data?.confidence ?? 0) ? 'Tín hiệu mới yếu hơn khuyến nghị ban đầu.' : null,
    positionRoi !== null && positionRoi < 0 ? 'Giá đang đi ngược hướng vị thế.' : null,
    Number(position?.leverage ?? 1) >= 5 ? 'Rủi ro vượt ngưỡng do đòn bẩy cao.' : null,
  ].filter((warning): warning is string => Boolean(warning));

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Button>

        {portfolio.isLoading ? (
          <DataSkeleton rows={3} />
        ) : !position ? (
          <EmptyState title="Không tìm thấy vị thế" />
        ) : (
          <>
            <PageHeader
              eyebrow="Theo dõi vị thế demo"
              title={`${tokenSymbol || 'Token chưa định danh'} · ${position.direction ?? 'LONG'}`}
              description="So sánh vị thế demo hiện tại với kế hoạch ban đầu, khuyến nghị gốc và tín hiệu mới cùng token."
              actions={
                <>
                  {position.proposalId ? (
                    <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                      <Link href={`/proposal/${position.proposalId}`}>Xem khuyến nghị gốc</Link>
                    </Button>
                  ) : null}
                  {latestSignal?._id ? (
                    <Button asChild variant="outline" className="border-purple-500/30 text-purple-300">
                      <Link href={`/signals/${latestSignal._id}`}>Xem tín hiệu hiện tại</Link>
                    </Button>
                  ) : null}
                  <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                    <Link href="/recommendations">Mở khuyến nghị</Link>
                  </Button>
                </>
              }
            />

            <section className="grid gap-4 lg:grid-cols-3">
              <Panel title="Tình trạng hiện tại">
                <Mini label="Giá vào" value={formatCurrency(position.entryPrice)} />
                <Mini label="Giá hiện tại" value="Chưa có dữ liệu giá hiện tại" />
                <Mini label="PnL" value={position.pnl === null || position.pnl === undefined ? 'Chưa có dữ liệu' : formatCurrency(position.pnl)} />
                <Mini label="ROI" value={positionRoi === null ? 'Chưa có dữ liệu' : formatPercent(positionRoi)} />
                <Mini label="Đòn bẩy" value={`${position.leverage ?? 1}x`} />
                <Mini label="Hướng lệnh demo" value={position.direction ?? 'LONG'} />
              </Panel>

              <Panel title="Cảnh báo">
                {warnings.map((warning) => <div key={warning} className={warningClassName(warning)}>{warning}</div>)}
                {!warnings.length ? <p className="text-sm text-slate-500">Không có cảnh báo nghiêm trọng.</p> : null}
              </Panel>

              <Panel title="Kế hoạch ban đầu">
                <Mini label="Giá yêu cầu" value={formatCurrency(position.requestedPrice)} />
                <Mini label="Giá khớp demo" value={formatCurrency(position.executedPrice)} />
                <Mini label="Trượt giá demo" value={formatPercent(normalizePercentValue(position.slippagePct))} />
                <Mini label="ID ghi nhận demo" value={formatDemoRecordId(position.txHash ?? position._id)} />
              </Panel>
            </section>

            <section className="glass-card rounded-xl border border-cyan-500/15 bg-cyan-500/10 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Bước tiếp theo</h2>
                  <p className="mt-1 text-sm text-cyan-100/80">
                    Kiểm tra cảnh báo, so sánh với tín hiệu hiện tại, rồi quyết định giữ mô phỏng, ghi chú hoặc quay lại khuyến nghị để đánh giá lại.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {position.proposalId ? (
                    <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                      <Link href={`/proposal/${position.proposalId}/scenario`}>Thử lại kịch bản</Link>
                    </Button>
                  ) : null}
                  <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                    <Link href="/positions">Tất cả vị thế demo</Link>
                  </Button>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Khuyến nghị gốc</h2>
                <div className="mt-4">
                  {proposal.data ? <ProposalCard proposal={proposal.data} href={`/proposal/${proposal.data._id}`} /> : <p className="text-sm text-slate-500">Chưa có dữ liệu khuyến nghị gốc.</p>}
                </div>
              </section>
              <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Tín hiệu hiện tại cùng token</h2>
                {latestSignal ? <p className="mt-1 text-sm text-slate-500">Tín hiệu mới nhất: {formatConfidence(latestSignal.confidence)}</p> : null}
                <div className="mt-4 space-y-3">
                  {currentSignals.slice(0, 3).map((signal) => <SignalCard key={signal._id} signal={signal} href={`/signals/${signal._id}`} />)}
                  {!currentSignals.length ? <p className="text-sm text-slate-500">Chưa có tín hiệu mới cùng token.</p> : null}
                </div>
              </section>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function warningClassName(warning: string) {
  const important = warning.includes('hết hạn') || warning.includes('đi ngược');
  return important
    ? 'rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200'
    : 'rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200';
}

function formatDemoRecordId(value?: string | null) {
  if (!value) return 'Chưa có dữ liệu';
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
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
