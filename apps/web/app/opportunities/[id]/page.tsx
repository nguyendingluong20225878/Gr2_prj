'use client';

import Link from 'next/link';
import type React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { CountdownBadge, DataSkeleton, EmptyState, PageHeader, SourceList } from '@/app/components/shared/NdlUi';
import { useProposalDetail, useSignalDetail } from '@/lib/hooks/useNdlData';
import { formatCurrency, formatNumber, formatPercent, normalizePercentValue, toDisplayAction, toDisplayRisk } from '@/lib/utils/formatters';

export default function OpportunityDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const proposal = useProposalDetail(id);
  const signalId = proposal.data?.signalContext?._id ?? proposal.data?.signalId;
  const signal = useSignalDetail(typeof signalId === 'string' ? signalId : undefined);
  const data = proposal.data;
  const pnl = normalizePercentValue(data?.pnlPercentage ?? data?.financialImpact?.roi);

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Button>

        {proposal.isLoading ? (
          <DataSkeleton rows={3} />
        ) : !data ? (
          <EmptyState title="Không tìm thấy cơ hội" />
        ) : (
          <>
            <PageHeader
              eyebrow="Chi tiết cơ hội"
              title={data.tokenSymbol ?? 'TOKEN'}
              description="Cơ hội được sinh từ tweet/news, Quant score, confidence và rationale tiếng Việt từ Layer3."
              actions={
                <>
                  <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                    <Link href={`/proposal/${data._id}`}>Vào chi tiết đề xuất</Link>
                  </Button>
                  {signal.data?._id ? (
                    <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                      <Link href={`/signals/${signal.data._id}`}>Xem phân tích Signal</Link>
                    </Button>
                  ) : null}
                </>
              }
            />

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" variant="outline">{toDisplayAction(data.action ?? data.suggestionType)}</Badge>
                <CountdownBadge value={data.expiresAt} />
                <Badge className="border-white/10 bg-black/40 text-slate-300" variant="outline">Risk: {toDisplayRisk(data.financialImpact?.riskLevel)}</Badge>
              </div>
              <p className="mt-4 text-base leading-relaxed text-slate-200">{data.summary ?? data.rationaleSummary ?? 'Chưa có dữ liệu rationale.'}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <Mini label="Quant score" value={formatNumber(data.quantScore, 2)} />
                <Mini label="Confidence" value={data.confidence !== null && data.confidence !== undefined ? `${data.confidence}%` : 'Chưa có dữ liệu'} />
                <Mini label="Backtest/PnL" value={data.roiStatus === 'NOT_AVAILABLE' || pnl === null ? 'Chưa backtest' : formatPercent(pnl)} />
                <Mini label="Entry / Exit" value={`${formatCurrency(data.entryPrice)} / ${formatCurrency(data.exitPrice)}`} />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Source chính tạo cơ hội</h2>
                <div className="mt-4">
                  <SourceList sources={data.sources ?? signal.data?.sources} />
                </div>
              </div>
              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Vì sao Token này được chọn?</h2>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <p>Token được chọn vì có score/confidence/source weight tốt nhất trong dữ liệu backend hiện có.</p>
                  <p>Danh sách token được nhắc tới trong cùng source cần API `matchedTokens` hoặc `sourceTokenCandidates`; UI hiện hiển thị trạng thái chờ API thay vì hardcode.</p>
                  <p>Signal validity: <CountdownBadge value={signal.data?.expiresAt ?? data.expiresAt} /></p>
                </div>
              </div>
            </section>
          </>
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
