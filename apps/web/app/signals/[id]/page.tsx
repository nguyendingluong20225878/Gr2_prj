'use client';

import Link from 'next/link';
import type React from 'react';
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

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Button>

        {signal.isLoading ? (
          <DataSkeleton rows={3} />
        ) : !data ? (
          <EmptyState title="Không tìm thấy Signal" />
        ) : (
          <>
            <PageHeader
              eyebrow="Phân tích Signal"
              title={data.tokenSymbol ?? 'TOKEN'}
              description="Dữ liệu định lượng đứng sau recommendation: Quant score, confidence, score components, lifecycle và nguồn evidence."
              actions={
                <>
                  {proposalId ? (
                    <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                      <Link href={`/signals/${id}/explanation?proposal=${proposalId}`}>Xem giải thích AI</Link>
                    </Button>
                  ) : null}
                  {proposalId ? (
                    <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                      <Link href={`/proposal/${proposalId}`}>Mở đề xuất</Link>
                    </Button>
                  ) : null}
                </>
              }
            />

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-300" variant="outline">{toDisplayAction(data.suggestionType)}</Badge>
                <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" variant="outline">{toDisplaySentiment(data.sentimentType)}</Badge>
                <Badge className="border-white/10 bg-black/40 text-slate-300" variant="outline">{data.lifecycleState ?? data.status ?? 'QUANT_READY'}</Badge>
                <CountdownBadge value={data.expiresAt} />
              </div>
              <p className="mt-4 text-base leading-relaxed text-slate-200">{data.rationaleSummary ?? data.enrichedProposal?.rationaleSummary ?? 'Chưa có dữ liệu rationale.'}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <Mini label="Quant score" value={formatNumber(data.quantScore ?? scoreComponents?.finalScore, 2)} />
                <Mini label="Confidence" value={data.confidence !== null && data.confidence !== undefined ? `${data.confidence}%` : 'N/A'} />
                <Mini label="Signal mode" value={data.metadata?.isNewToken ? 'COLD_START' : 'NORMALIZED_ALPHA'} />
                <Mini label="Phát hiện lúc" value={formatVietnameseDateTime(data.detectedAt)} />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Score components</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Mini label="timeZ" value={formatNumber(scoreComponents?.timeZ, 3)} />
                  <Mini label="pureAlphaZ" value={formatNumber(scoreComponents?.pureAlphaZ, 3)} />
                  <Mini label="crossZ" value={formatNumber(scoreComponents?.crossZ, 3)} />
                  <Mini label="finalScore" value={formatNumber(scoreComponents?.finalScore, 3)} />
                  <Mini label="Entropy" value={formatNumber(data.uncertaintyEntropy ?? data.metadata?.uncertaintyEntropy, 3)} />
                  <Mini label="Realized volatility" value={formatNumber(data.realizedVolatility ?? data.metadata?.realizedVolatility, 3)} />
                </div>
              </div>

              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Confidence breakdown</h2>
                <div className="mt-4 space-y-2">
                  {(data.confidenceBreakdown ?? []).map((item) => (
                    <div key={item.label} className="rounded-lg border border-white/5 bg-black/40 px-3 py-2 text-sm text-slate-300">
                      {item.label} · {item.impact}
                    </div>
                  ))}
                  {!data.confidenceBreakdown?.length ? <p className="text-sm text-slate-500">Chưa có breakdown chi tiết.</p> : null}
                </div>
              </div>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Nguồn evidence</h2>
              <div className="mt-4">
                <SourceList sources={data.sources} />
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
