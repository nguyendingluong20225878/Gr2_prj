'use client';

import Link from 'next/link';
import { Badge } from '@/app/components/ui/badge';
import { Layout } from '@/app/components/layout/Layout';
import { DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useNdlData } from '@/lib/hooks/useNdlData';
import { formatConfidence, toDisplayAction } from '@/lib/utils/formatters';

export default function OpportunitiesPage() {
  const { signals, proposals } = useNdlData();
  const proposalBySignalId = new Map((proposals.data ?? []).map((proposal) => [String(proposal.signalId ?? ''), proposal]));

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Cơ hội từ news/tweets"
          title="Signal được phát hiện từ nguồn tin"
          description="Mỗi cơ hội bắt đầu từ tweet/news, token được nhận diện, chấm Quant score và được Layer3 diễn giải thành đề xuất."
        />

        {signals.isLoading ? (
          <DataSkeleton rows={5} />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(signals.data ?? []).map((signal) => {
              const linkedProposal = signal.enrichedProposal?._id ? signal.enrichedProposal : proposalBySignalId.get(signal._id);
              const href = linkedProposal?._id ? `/opportunities/${linkedProposal._id}` : `/signals/${signal._id}`;
              const action = signal.suggestionType ?? linkedProposal?.action ?? linkedProposal?.suggestionType;
              const source = getSourceLabel(signal.sources?.[0]);
              return (
                <Link key={signal._id} href={href} className="glass-card block rounded-xl border border-white/5 bg-black/20 p-5 transition-colors hover:border-purple-500/30 hover:bg-white/[0.03]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-white">{signal.tokenSymbol ?? linkedProposal?.tokenSymbol ?? 'TOKEN'}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-300" variant="outline">Signal</Badge>
                        <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" variant="outline">{toDisplayAction(action)}</Badge>
                      </div>
                    </div>
                    <span className="text-slate-500">→</span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <Mini label="Tin cậy" value={formatConfidence(signal.confidence)} />
                    <Mini label="Nguồn" value={source} />
                  </div>
                </Link>
              );
            })}
            {!signals.data?.length ? <EmptyState title="Chưa có cơ hội từ news/tweets" /> : null}
          </section>
        )}
      </div>
    </Layout>
  );
}

function getSourceLabel(source?: { label?: string; name?: string; sourceKey?: string; url?: string }) {
  return source?.label ?? source?.name ?? source?.sourceKey ?? 'Chưa có nguồn';
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
