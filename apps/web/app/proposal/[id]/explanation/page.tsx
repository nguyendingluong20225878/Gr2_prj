'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { DataSkeleton, EmptyState } from '@/app/components/shared/NdlUi';
import { useProposalDetail, useProposalScoreExplanation } from '@/lib/hooks/useNdlData';
import { formatNumber } from '@/lib/utils/formatters';

export default function ProposalExplanationPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const proposal = useProposalDetail(id);
  const explanation = useProposalScoreExplanation(id);
  const data = explanation.data;

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại đề xuất
        </Button>

        {explanation.isLoading || proposal.isLoading ? (
          <DataSkeleton rows={5} />
        ) : !data ? (
          <EmptyState title="Không có dữ liệu giải thích điểm" />
        ) : (
          <>
            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Score explanation</p>
              <h1 className="mt-2 text-3xl font-black text-white">
                {proposal.data?.tokenSymbol ?? 'TOKEN'} · confidence {data.confidence ?? 'N/A'}% · quant {formatNumber(data.finalScore, 2)}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
                Confidence không phải xác suất có lời. Nó phản ánh độ mạnh tín hiệu sau khi backend áp cap, penalty theo sample size và giới hạn cold-start.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">{data.signalMode ?? 'UNKNOWN_MODE'}</Badge>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300">sampleSize: {data.sampleSize ?? 'N/A'}</Badge>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300">cap: {data.confidenceCap === null || data.confidenceCap === undefined ? 'N/A' : `${data.confidenceCap * 100}%`}</Badge>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Panel title="Formula">
                <Formula label="Confidence" value={data.confidenceFormula} />
                <Formula label="Quant" value={data.quantFormula} />
              </Panel>

              <Panel title="Breakdown">
                <Mini label="finalScore" value={formatNumber(data.finalScore, 4)} />
                <Mini label="confidenceDivisor" value={formatNumber(data.thresholds.confidenceDivisor, 4)} />
                <Mini label="coldStartConfidenceDivisor" value={formatNumber(data.thresholds.coldStartConfidenceDivisor, 4)} />
                <Mini label="sampleSizePenalty" value={formatNumber(data.sampleSizePenalty, 4)} />
                <Mini label="signalThreshold" value={formatNumber(data.thresholds.signalThreshold, 4)} />
                <Mini label="actionThreshold" value={formatNumber(data.thresholds.actionThreshold, 4)} />
              </Panel>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ListPanel title="Positive factors" items={data.positiveFactors} empty="Chưa có yếu tố tích cực được backend xác định." tone="green" />
              <ListPanel title="Negative factors" items={data.negativeFactors} empty="Chưa có yếu tố hạn chế rõ ràng." tone="amber" />
            </section>

            <Panel title="Raw score components">
              {data.scoreComponents && Object.keys(data.scoreComponents).length ? (
                Object.entries(data.scoreComponents).map(([key, value]) => (
                  <Mini key={key} label={key} value={typeof value === 'number' ? formatNumber(value, 4) : String(value)} />
                ))
              ) : (
                <p className="text-sm text-slate-400">Chưa có score components.</p>
              )}
            </Panel>

            <Panel title="Audit trail">
              {data.auditTrail.map((item) => (
                <div key={item.step} className="rounded-lg border border-white/5 bg-black/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{item.step}</p>
                    <Badge variant="outline" className={auditTone(item.status)}>{item.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
                </div>
              ))}
            </Panel>

            <div className="flex justify-end">
              <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                <Link href={`/proposal/${id}`}>Quay lại giao diện quyết định</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <h2 className="mb-4 text-lg font-bold text-white">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Formula({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/40 p-3 md:col-span-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <code className="mt-2 block whitespace-pre-wrap text-sm text-cyan-200">{value}</code>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function ListPanel({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: 'green' | 'amber' }) {
  const bullet = tone === 'green' ? 'bg-green-400' : 'bg-amber-400';
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="mt-4 space-y-2">
        {items.length ? items.map((item) => (
          <p key={item} className="flex gap-2 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-sm text-slate-300">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${bullet}`} />
            {item}
          </p>
        )) : (
          <p className="rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">{empty}</p>
        )}
      </div>
    </section>
  );
}

function auditTone(status: string) {
  if (status === 'OK') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (status === 'LIMITED') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-red-500/30 bg-red-500/10 text-red-300';
}
