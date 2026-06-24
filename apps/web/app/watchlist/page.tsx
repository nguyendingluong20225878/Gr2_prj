'use client';

import Link from 'next/link';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/app/components/layout/Layout';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useNdlData, type ProposalData, type WatchlistData } from '@/lib/hooks/useNdlData';
import { formatConfidence, formatPercent, normalizeConfidenceValue, normalizePercentValue, toDisplayAction } from '@/lib/utils/formatters';
import { getHoldingSymbolSet } from '@/lib/utils/proposals';
import { formatRelativeVietnamese, isExpired } from '@/lib/utils/time';

type WatchItem = {
  id: string;
  status?: 'WATCHING' | 'RESOLVED' | 'EXPIRED';
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
  const { portfolio, proposals, watchlist } = useNdlData();
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const watchItems = useMemo(() => {
    const proposalsById = new Map((proposals.data ?? []).map((proposal) => [proposal._id, proposal]));
    const heldSymbols = getHoldingSymbolSet(portfolio.data?.holdings ?? []);
    const apiItems = normalizeWatchlistItems(watchlist.data, proposalsById);
    const fallbackItems: WatchItem[] = (portfolio.data?.watchlist ?? []).map((item) => {
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
    const realItems = apiItems.length ? apiItems : fallbackItems;
    return realItems
      .map((item) => ({ ...item, states: getWatchStates(item, heldSymbols) }))
      .sort((a, b) => {
        const confidenceA = normalizeConfidenceValue(a.confidence) ?? 0;
        const confidenceB = normalizeConfidenceValue(b.confidence) ?? 0;
        if (confidenceA !== confidenceB) return confidenceB - confidenceA;
        return getTime(b.createdAt) - getTime(a.createdAt);
      });
  }, [portfolio.data?.holdings, portfolio.data?.watchlist, proposals.data, watchlist.data]);
  const pendingItems = watchItems.filter((item) => !isWatchExpired(item) && !hasBacktestResult(item));
  const verifiedItems = watchItems.filter((item) => !isWatchExpired(item) && hasBacktestResult(item));
  const expiredItems = watchItems.filter(isWatchExpired);

  const handleRemove = async (proposalId?: string | null) => {
    if (!proposalId || removingIds.has(proposalId)) return;
    if (!window.confirm('Xóa khuyến nghị này khỏi danh sách theo dõi?')) return;

    const previousItems = watchlist.data;
    setRemovingIds((current) => new Set(current).add(proposalId));
    await watchlist.mutate((current) => current?.filter((item) => item.proposalId !== proposalId), false);

    try {
      const response = await fetch(`/api/watchlist/${proposalId}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Không xóa được khỏi watchlist');
      await Promise.all([watchlist.mutate(), portfolio.mutate()]);
      toast.success('Đã xóa khỏi danh sách theo dõi.');
    } catch (error) {
      await watchlist.mutate(previousItems, false);
      toast.error(error instanceof Error ? error.message : 'Không xóa được khỏi watchlist');
    } finally {
      setRemovingIds((current) => {
        const next = new Set(current);
        next.delete(proposalId);
        return next;
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Danh sách theo dõi"
          title="Tôi đang chờ điều kiện gì?"
          description="Theo dõi các khuyến nghị chưa quyết định: còn hiệu lực không, đang chờ dữ liệu gì và bước tiếp theo nên làm."
          actions={
            <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
              <Link href="/recommendations">Tìm khuyến nghị mới</Link>
            </Button>
          }
        />

        {portfolio.isLoading || proposals.isLoading || watchlist.isLoading ? (
          <DataSkeleton rows={3} />
        ) : (
          <div className="space-y-6">
            <WatchGroup title="Đang chờ kiểm chứng" description="Khuyến nghị chưa đủ thời gian hoặc chưa có kết quả để kết luận." items={pendingItems} onRemove={handleRemove} removingIds={removingIds} />
            <WatchGroup title="Đã có kết quả" description="Khuyến nghị đã có backtest hoặc PnL thực sau kiểm chứng." items={verifiedItems} onRemove={handleRemove} removingIds={removingIds} />
            <WatchGroup title="Đã hết hạn" description="Khuyến nghị đã hết hiệu lực theo thời gian; ROI tạm tính không được xem là kết quả kiểm chứng." items={expiredItems} onRemove={handleRemove} removingIds={removingIds} />
            {!watchItems.length ? (
              <div className="space-y-3">
                <EmptyState title="Chưa có cơ hội đang theo dõi" description="Các khuyến nghị còn hiệu lực được đưa vào theo dõi sẽ xuất hiện tại đây." />
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                    <Link href="/recommendations">Xem khuyến nghị</Link>
                  </Button>
                  <Button asChild variant="outline" className="border-white/10 text-slate-200">
                    <Link href="/overview">Quay về tổng quan</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Layout>
  );
}

function normalizeWatchlistItems(items: WatchlistData | undefined, proposalsById: Map<string, ProposalData>): WatchItem[] {
  return (items ?? []).map((item) => {
    const proposal = item.proposal ?? proposalsById.get(item.proposalId);
    return {
      id: item.proposalId,
      status: item.status,
      tokenSymbol: proposal?.tokenSymbol,
      title: proposal?.summary ?? proposal?.title,
      proposalId: item.proposalId,
      confidence: proposal?.confidence,
      roi: proposal?.financialImpact?.roi,
      createdAt: item.addedAt ?? proposal?.createdAt,
      proposal: proposal ?? undefined,
      reason: item.reason,
    };
  });
}

function WatchGroup({
  description,
  items,
  onRemove,
  removingIds,
  title,
}: {
  title: string;
  description: string;
  items: Array<WatchItem & { states: string[] }>;
  onRemove: (proposalId?: string | null) => void;
  removingIds: Set<string>;
}) {
  if (!items.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex flex-wrap gap-4">
        {items.map((item) => <WatchCard key={item.id} item={item} onRemove={onRemove} removing={Boolean(item.proposalId && removingIds.has(item.proposalId))} />)}
      </div>
    </section>
  );
}

function WatchCard({
  item,
  onRemove,
  removing,
}: {
  item: WatchItem & { states: string[] };
  onRemove: (proposalId?: string | null) => void;
  removing: boolean;
}) {
  return (
    <article className="glass-card w-full rounded-xl border border-white/5 bg-black/20 p-5 md:w-[calc(50%-0.5rem)] xl:w-[calc(33.333%-0.667rem)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-white">{item.tokenSymbol ?? 'Token chưa định danh'}</p>
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
        <Mini label="ROI tạm tính" value={item.roi === null || item.roi === undefined ? 'Chưa có dữ liệu' : formatPercent(normalizePercentValue(item.roi))} />
        <Mini label="Cập nhật" value={formatRelativeVietnamese(item.createdAt)} />
        <Mini label="Đang chờ" value={getWatchReason(item)} />
      </div>
      {item.proposalId ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="border-cyan-500/30 text-cyan-300">
            <Link href={`/proposal/${item.proposalId}`}>Xem khuyến nghị</Link>
          </Button>
          {!isWatchExpired(item) && !hasBacktestResult(item) ? (
            <Button asChild size="sm" className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
              <Link href={`/proposal/${item.proposalId}/scenario`}>Thử kịch bản</Link>
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={removing}
            onClick={() => onRemove(item.proposalId)}
            className="border-red-500/30 text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            {removing ? 'Đang xóa' : 'Xóa theo dõi'}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function getWatchStates(item: WatchItem, heldSymbols: Set<string>) {
  const states = [getPrimaryWatchState(item)];
  const confidence = normalizeConfidenceValue(item.confidence);
  const symbol = String(item.tokenSymbol ?? '').toUpperCase();

  if (hasBacktestResult(item)) states.push('Có backtest/PNL');
  if (confidence !== null && confidence >= 70) states.push('Độ tin cậy cao');
  if (symbol && !heldSymbols.has(symbol)) states.push('Chưa có trong danh mục');
  return states.slice(0, 3);
}

function hasBacktestResult(item: WatchItem) {
  if (item.status === 'RESOLVED') return true;
  return Boolean(
    item.proposal?.backtestedAt ||
    item.proposal?.winLossStatus ||
    item.proposal?.pnlPercentage !== null && item.proposal?.pnlPercentage !== undefined
  );
}

function isWatchExpired(item: WatchItem) {
  if (item.status === 'EXPIRED') return true;
  return isExpired(item.proposal?.expiresAt);
}

function getPrimaryWatchState(item: WatchItem) {
  if (item.status === 'EXPIRED') return 'Đã hết hạn';
  if (item.status === 'RESOLVED') return 'Đã có kết quả';
  if (isWatchExpired(item)) return 'Đã hết hạn';
  if (hasBacktestResult(item)) return 'Đã có kết quả';
  return 'Đang chờ kiểm chứng';
}

function getWatchReason(item: WatchItem) {
  const confidence = normalizeConfidenceValue(item.confidence);
  const reason = item.reason;
  if (item.status === 'RESOLVED' || hasBacktestResult(item)) return 'Đọc kết quả, không xem như cơ hội mới';
  if (item.status === 'EXPIRED' || isWatchExpired(item)) return 'Đã hết hiệu lực, nên bỏ theo dõi hoặc chỉ tham khảo';
  if (isUserConditionReason(reason)) return clampText(reason, 96);
  if (confidence !== null && confidence >= 70) return 'Chờ vùng giá hoặc dữ liệu xác nhận thêm';
  return 'Chờ thêm dữ liệu trước khi quyết định';
}

function isUserConditionReason(reason?: string | null): reason is string {
  if (!reason) return false;
  return /chờ|đợi|vùng giá|xác nhận|điều kiện|theo dõi thêm/i.test(reason)
    && !/từ\s+(Recommendation Center|Tổng quan|màn chi tiết)|khuyến nghị từ/i.test(reason);
}

function clampText(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
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
      <p className="mt-1 line-clamp-2 text-sm text-slate-200">{value}</p>
    </div>
  );
}
