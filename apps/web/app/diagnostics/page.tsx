'use client';

import Link from 'next/link';
import type React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Database } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { DataSkeleton, EmptyState, MetricCard, PageHeader, ProposalCard, SignalCard } from '@/app/components/shared/NdlUi';
import { useNdlData } from '@/lib/hooks/useNdlData';
import { normalizeConfidenceValue } from '@/lib/utils/formatters';
import { getLatestActiveProposalPerToken, isProposalForHoldings } from '@/lib/utils/proposals';
import { isExpiringSoon } from '@/lib/utils/time';

export default function DiagnosticsPage() {
  const { portfolio, proposals, signals } = useNdlData();
  const holdings = portfolio.data?.holdings ?? [];
  const proposalList = getLatestActiveProposalPerToken(proposals.data ?? []);
  const signalList = signals.data ?? [];

  const heldOpportunities = proposalList.filter((proposal) => isProposalForHoldings(proposal, holdings)).slice(0, 4);
  const riskyAssets = holdings.filter((holding) => holding.dataQuality === 'MISSING_PRICE').slice(0, 4);
  const tokensWithoutSignals = holdings.filter((holding) => !signalList.some((signal) => String(signal.tokenSymbol ?? '').toUpperCase() === holding.symbol.toUpperCase()));
  const expiringSignals = signalList.filter((signal) => isExpiringSoon(signal.expiresAt, 6 * 60 * 60 * 1000)).slice(0, 4);
  const confidenceValues = signalList
    .map((signal) => normalizeConfidenceValue(signal.confidence))
    .filter((value): value is number => value !== null);
  const averageConfidence = confidenceValues.length
    ? confidenceValues.reduce((sum, confidence) => sum + confidence, 0) / confidenceValues.length
    : null;

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Chẩn đoán danh mục"
          title="Tài sản nào cần hành động?"
          description="NDL đối chiếu Portfolio với Signal, proposal, dữ liệu giá và thời hạn hiệu lực để chỉ ra rủi ro hoặc cơ hội đáng chú ý."
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

        {portfolio.isLoading || proposals.isLoading || signals.isLoading ? (
          <DataSkeleton rows={4} />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Tài sản có cơ hội" value={heldOpportunities.length} hint="Có proposal liên quan" />
              <MetricCard label="Tài sản rủi ro" value={riskyAssets.length} hint="Thiếu giá hoặc dữ liệu yếu" />
              <MetricCard label="Tài sản thiếu Signal" value={tokensWithoutSignals.length} hint="Không có Signal gần đây" />
              <MetricCard label="Độ tin cậy TB" value={averageConfidence === null ? 'N/A' : `${averageConfidence.toFixed(0)}%`} hint="Từ confidence" />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Panel title="Tài sản có cơ hội nhất" icon={<CheckCircle2 className="h-5 w-5 text-green-300" />}>
                {heldOpportunities.map((proposal) => <ProposalCard key={proposal._id} proposal={proposal} href={`/proposal/${proposal._id}`} />)}
                {!heldOpportunities.length ? <EmptyState title="Chưa có cơ hội trên tài sản đang giữ" /> : null}
              </Panel>

              <Panel title="Tài sản rủi ro nhất" icon={<AlertTriangle className="h-5 w-5 text-amber-300" />}>
                {riskyAssets.map((holding) => (
                  <Link key={holding.symbol} href={`/tokens/${holding.symbol}`} className="block rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                    {holding.symbol}: chất lượng dữ liệu giá {holding.dataQuality ?? 'Chưa có dữ liệu'}
                  </Link>
                ))}
                {!riskyAssets.length ? <p className="text-sm text-slate-500">Không phát hiện holding thiếu giá.</p> : null}
              </Panel>

              <Panel title="Tài sản thiếu tín hiệu" icon={<Database className="h-5 w-5 text-slate-400" />}>
                {tokensWithoutSignals.slice(0, 6).map((holding) => (
                  <Link key={holding.symbol} href={`/tokens/${holding.symbol}`} className="block rounded-xl border border-white/5 bg-black/40 p-4 text-sm text-slate-300">
                    {holding.symbol}: chưa có Signal gần đây
                  </Link>
                ))}
                {!tokensWithoutSignals.length ? <p className="text-sm text-slate-500">Tất cả holdings đều có Signal gần đây.</p> : null}
              </Panel>

              <Panel title="Signal sắp hết hạn" icon={<Clock className="h-5 w-5 text-cyan-300" />}>
                {expiringSignals.map((signal) => <SignalCard key={signal._id} signal={signal} href={`/signals/${signal._id}`} />)}
                {!expiringSignals.length ? <p className="text-sm text-slate-500">Không có Signal sắp hết hạn.</p> : null}
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
