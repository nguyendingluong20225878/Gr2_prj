'use client';

import Link from 'next/link';
import type React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Database } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { DataSkeleton, EmptyState, getMissingPriceReasonLabel, MetricCard, PageHeader, ProposalCard } from '@/app/components/shared/NdlUi';
import { useNdlData } from '@/lib/hooks/useNdlData';
import { normalizeConfidenceValue } from '@/lib/utils/formatters';
import { getLatestActiveProposalPerToken, isProposalForHoldings } from '@/lib/utils/proposals';
import { isExpiringSoon } from '@/lib/utils/time';

export default function DiagnosticsPage() {
  const { portfolio, proposals } = useNdlData();
  const holdings = portfolio.data?.holdings ?? [];
  const proposalList = getLatestActiveProposalPerToken(proposals.data ?? []);

  const heldOpportunities = proposalList.filter((proposal) => isProposalForHoldings(proposal, holdings)).slice(0, 4);
  const riskyAssets = holdings.filter((holding) => holding.dataQuality === 'MISSING_PRICE').slice(0, 4);
  const tokensWithoutProposal = holdings.filter((holding) => !proposalList.some((proposal) => String(proposal.tokenSymbol ?? '').toUpperCase() === holding.symbol.toUpperCase()));
  const expiringProposals = proposalList.filter((proposal) => isExpiringSoon(proposal.expiresAt, 6 * 60 * 60 * 1000)).slice(0, 4);
  const confidenceValues = proposalList
    .map((proposal) => normalizeConfidenceValue(proposal.confidence))
    .filter((value): value is number => value !== null);
  const averageConfidence = confidenceValues.length
    ? confidenceValues.reduce((sum, confidence) => sum + confidence, 0) / confidenceValues.length
    : null;

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Chẩn đoán danh mục"
          title="Sức khỏe và rủi ro cấu trúc"
          description="Trang này không thay thế Danh mục. Nó tập trung vào chất lượng dữ liệu, khoảng trống luận điểm, khuyến nghị sắp hết hạn và các điểm yếu cần kiểm tra trước khi ra quyết định."
          actions={
            <>
              <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                <Link href="/recommendations">Xem khuyến nghị</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/10">
                <Link href="/data-check">Kiểm tra trạng thái dữ liệu</Link>
              </Button>
            </>
          }
        />

        {portfolio.isLoading || proposals.isLoading ? (
          <DataSkeleton rows={4} />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Có cơ hội" value={heldOpportunities.length} hint="Holding có khuyến nghị liên quan" />
              <MetricCard label="Cần kiểm tra dữ liệu" value={riskyAssets.length} hint="Thiếu mapping hoặc giá" />
              <MetricCard label="Chưa có luận điểm" value={tokensWithoutProposal.length} hint="Holding chưa có khuyến nghị liên quan" />
              <MetricCard label="Độ tin cậy TB" value={averageConfidence === null ? 'Chưa có dữ liệu' : `${averageConfidence.toFixed(0)}%`} hint="Từ độ tin cậy của khuyến nghị" />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Panel title="Có cơ hội" icon={<CheckCircle2 className="h-5 w-5 text-green-300" />}>
                <p className="text-sm text-slate-500">Holding có khuyến nghị liên quan để mở đọc luận điểm và quyết định tiếp theo.</p>
                {heldOpportunities.map((proposal) => <ProposalCard key={proposal._id} proposal={proposal} href={`/proposal/${proposal._id}`} />)}
                {!heldOpportunities.length ? <EmptyState title="Chưa có cơ hội trên tài sản đang giữ" /> : null}
              </Panel>

              <Panel title="Cần kiểm tra dữ liệu" icon={<AlertTriangle className="h-5 w-5 text-amber-300" />}>
                <p className="text-sm text-slate-500">Tài sản thiếu mapping hoặc thiếu giá, nên các số portfolio có thể chưa đầy đủ.</p>
                {riskyAssets.map((holding) => (
                  <Link key={holding.symbol} href={`/tokens/${holding.symbol}`} className="block rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                    {holding.symbol}: {getMissingPriceReasonLabel(holding.missingReason)}
                  </Link>
                ))}
                {!riskyAssets.length ? <p className="text-sm text-slate-500">Không phát hiện holding thiếu giá.</p> : null}
              </Panel>

              <Panel title="Chưa có luận điểm" icon={<Database className="h-5 w-5 text-slate-400" />}>
                <p className="text-sm text-slate-500">Holding chưa có khuyến nghị liên quan, nên hệ thống chưa đủ luận điểm để đánh giá hành động.</p>
                {tokensWithoutProposal.slice(0, 6).map((holding) => (
                  <Link key={holding.symbol} href={`/tokens/${holding.symbol}`} className="block rounded-xl border border-white/5 bg-black/40 p-4 text-sm text-slate-300">
                    {holding.symbol}: Chưa có khuyến nghị liên quan
                  </Link>
                ))}
                {!tokensWithoutProposal.length ? <p className="text-sm text-slate-500">Tất cả holdings đều có khuyến nghị liên quan.</p> : null}
              </Panel>

              <Panel title="Khuyến nghị gần hết hiệu lực" icon={<Clock className="h-5 w-5 text-cyan-300" />}>
                <p className="text-sm text-slate-500">Khuyến nghị gần hết hạn có thể làm giảm số lượng việc đang cần xử lý, nên cần đọc lại luận điểm trước khi hành động.</p>
                {expiringProposals.map((proposal) => <ProposalCard key={proposal._id} proposal={proposal} href={`/proposal/${proposal._id}`} />)}
                {!expiringProposals.length ? <p className="text-sm text-slate-500">Không có khuyến nghị gần hết hiệu lực.</p> : null}
              </Panel>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {icon}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
