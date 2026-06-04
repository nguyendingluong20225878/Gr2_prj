'use client';

import Link from 'next/link';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/app/components/layout/Layout';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useNdlData, type ProposalData } from '@/lib/hooks/useNdlData';
import { getMockWatchlist, type MockWatchlistItem } from '@/services/mockApi';
import { formatConfidence, formatPercent, normalizeConfidenceValue, normalizePercentValue, toDisplayAction } from '@/lib/utils/formatters';
import { getHoldingSymbolSet } from '@/lib/utils/proposals';
import { formatRelativeVietnamese } from '@/lib/utils/time';

type WatchItem = {
  id: string;
  tokenSymbol?: string | null;
  title?: string | null;
  proposalId?: string | null;
  confidence?: number | null;
  roi?: number | null;
  createdAt?: string | Date | null;
  proposal?: ProposalData;
  reason?: string | null;
};

export default function WatchlistPage() {
  const { portfolio, proposals } = useNdlData();
  const [mockWatchlist, setMockWatchlist] = useState<MockWatchlistItem[]>([]);

  useEffect(() => {
    void getMockWatchlist().then(setMockWatchlist);
  }, []);

  const watchItems = useMemo(() => {
    const proposalsById = new Map((proposals.data ?? []).map((proposal) => [proposal._id, proposal]));
    const heldSymbols = getHoldingSymbolSet(portfolio.data?.holdings ?? []);
    const realItems: WatchItem[] = (portfolio.data?.watchlist ?? []).map((item) => {
      const proposal = proposalsById.get(item._id);
      return {
        id: item._id,
        tokenSymbol: item.tokenSymbol ?? proposal?.tokenSymbol,
        title: item.title ?? proposal?.summary ?? proposal?.title,
        proposalId: item._id,
        confidence: item.confidence ?? proposal?.confidence,
        roi: item.roi ?? proposal?.financialImpact?.roi,
        createdAt: item.createdAt ?? proposal?.createdAt,
        proposal,
      };
    });

    const fallbackItems: WatchItem[] = mockWatchlist.map((item) => {
      const proposal = proposalsById.get(item.proposalId);
      return {
        id: item.id,
        tokenSymbol: item.tokenSymbol ?? proposal?.tokenSymbol,
        title: item.title ?? proposal?.summary ?? proposal?.title,
        proposalId: item.proposalId,
        confidence: proposal?.confidence,
        roi: proposal?.financialImpact?.roi,
        createdAt: item.createdAt ?? proposal?.createdAt,
        proposal,
        reason: item.reason,
      };
    });

    return (realItems.length ? realItems : fallbackItems)
      .map((item) => ({ ...item, states: getWatchStates(item, heldSymbols) }))
      .sort((a, b) => {
        const confidenceA = normalizeConfidenceValue(a.confidence) ?? 0;
        const confidenceB = normalizeConfidenceValue(b.confidence) ?? 0;
        if (confidenceA !== confidenceB) return confidenceB - confidenceA;
        return getTime(b.createdAt) - getTime(a.createdAt);
      });
  }, [mockWatchlist, portfolio.data?.holdings, portfolio.data?.watchlist, proposals.data]);

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Danh sách theo dõi"
          title="Cơ hội đang quan sát"
          description="Những token/proposal bạn đang theo dõi trước khi quyết định hành động."
        />

        {portfolio.isLoading || proposals.isLoading ? (
          <DataSkeleton rows={3} />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {watchItems.map((item) => (
              <article key={item.id} className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-white">{item.tokenSymbol ?? 'TOKEN'}</p>
                    {item.title ? <p className="mt-1 line-clamp-2 text-sm text-slate-400">{item.title}</p> : null}
                  </div>
                  {item.proposal ? (
                    <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-300" variant="outline">{toDisplayAction(item.proposal.action ?? item.proposal.suggestionType)}</Badge>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.states.map((state) => (
                    <Badge key={state} className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" variant="outline">{state}</Badge>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Mini label="Tin cậy" value={formatConfidence(item.confidence)} />
                  <Mini label="ROI" value={item.roi === null || item.roi === undefined ? 'Chưa backtest' : formatPercent(normalizePercentValue(item.roi))} />
                  <Mini label="Cập nhật" value={formatRelativeVietnamese(item.createdAt)} />
                  <Mini label="Lý do" value={item.reason ?? getWatchReason(item)} />
                </div>
                {item.proposalId ? (
                  <Button asChild size="sm" variant="outline" className="mt-4 border-cyan-500/30 text-cyan-300">
                    <Link href={`/proposal/${item.proposalId}`}>Xem proposal</Link>
                  </Button>
                ) : null}
              </article>
            ))}
            {!watchItems.length ? <EmptyState title="Chưa có cơ hội đang theo dõi" description="Các proposal bạn chọn theo dõi sẽ xuất hiện tại đây." /> : null}
          </section>
        )}
      </div>
    </Layout>
  );
}

function getWatchStates(item: WatchItem, heldSymbols: Set<string>) {
  const states = ['Signal mới'];
  const confidence = normalizeConfidenceValue(item.confidence);
  const symbol = String(item.tokenSymbol ?? '').toUpperCase();

  if (confidence !== null && confidence >= 70) states.push('Confidence cao');
  if (symbol && !heldSymbols.has(symbol)) states.push('Chưa có trong danh mục');
  return states.slice(0, 3);
}

function getWatchReason(item: WatchItem) {
  const confidence = normalizeConfidenceValue(item.confidence);
  if (confidence !== null && confidence >= 70) return 'Đáng theo dõi vì confidence cao';
  if (item.proposal) return 'Có proposal đang chờ quyết định';
  return 'Đang quan sát trước khi hành động';
}

function getTime(value?: string | Date | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  );
}
