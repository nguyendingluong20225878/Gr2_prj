'use client';

import Link from 'next/link';
import type React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { DataSkeleton, EmptyState, HoldingRow, PageHeader, ProposalCard, SignalCard } from '@/app/components/shared/NdlUi';
import { useNdlData } from '@/lib/hooks/useNdlData';
import { formatCurrency, formatPercent, normalizePercentValue } from '@/lib/utils/formatters';

export default function TokenHoldingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const symbol = String(params.symbol ?? '').toUpperCase();
  const { portfolio, proposals, signals } = useNdlData();
  const holding = portfolio.data?.holdings?.find((item) => item.symbol.toUpperCase() === symbol);
  const totalValue = portfolio.data?.stats?.totalValue ?? null;
  const relatedProposals = (proposals.data ?? []).filter((proposal) => String(proposal.tokenSymbol ?? '').toUpperCase() === symbol);
  const relatedSignals = (signals.data ?? []).filter((signal) => String(signal.tokenSymbol ?? '').toUpperCase() === symbol);
  const bestProposal = relatedProposals[0];
  const allocation = totalValue && holding?.value ? (holding.value / totalValue) * 100 : null;
  const bestProposalPnl = normalizePercentValue(bestProposal?.pnlPercentage ?? bestProposal?.financialImpact?.roi);

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Button>

        <PageHeader
          eyebrow="Chi tiết tài sản đang có"
          title={symbol || 'Token'}
          description="Màn hình này trả lời bạn đang giữ bao nhiêu, dữ liệu giá có đủ không, Signal nào liên quan và nên làm gì tiếp theo."
          actions={
            <>
              {bestProposal ? (
                <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                  <Link href={`/proposal/${bestProposal._id}`}>Mở đề xuất</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                <Link href={`/recommendations?token=${symbol}`}>Xem đề xuất cho tài sản này</Link>
              </Button>
            </>
          }
        />

        {portfolio.isLoading || proposals.isLoading || signals.isLoading ? (
          <DataSkeleton rows={4} />
        ) : !holding ? (
          <EmptyState title={`Không tìm thấy ${symbol} trong Portfolio`} description="Token này có thể chưa được đồng bộ từ ví." />
        ) : (
          <>
            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <HoldingRow holding={holding} totalValue={totalValue} />
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Mini label="Tỷ trọng Portfolio" value={allocation === null ? 'N/A' : `${allocation.toFixed(2)}%`} />
                <Mini label="Giá hiện tại" value={formatCurrency(holding.price)} />
                <Mini label="Giá trị USD" value={formatCurrency(holding.value)} />
                <Mini label="ROI/PnL quá khứ" value={bestProposalPnl === null ? 'Chưa backtest' : formatPercent(bestProposalPnl)} />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Proposal liên quan</h2>
                <div className="mt-4 space-y-3">
                  {relatedProposals.map((proposal) => <ProposalCard key={proposal._id} proposal={proposal} href={`/proposal/${proposal._id}`} />)}
                  {!relatedProposals.length ? <p className="text-sm text-slate-500">Chưa có proposal cho Token này.</p> : null}
                </div>
              </div>

              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Signal và nguồn evidence</h2>
                <div className="mt-4 space-y-3">
                  {relatedSignals.map((signal) => <SignalCard key={signal._id} signal={signal} href={`/signals/${signal._id}`} />)}
                  {!relatedSignals.length ? <p className="text-sm text-slate-500">Chưa có Signal gần đây.</p> : null}
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
