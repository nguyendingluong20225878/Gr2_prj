'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useProposalDetail, useProposalTimeline } from '@/lib/hooks/useNdlData';
import { formatCurrency, formatPercent, normalizePercentValue } from '@/lib/utils/formatters';
import { formatVietnameseDateTime, isExpired } from '@/lib/utils/time';
import { deriveRecommendationStatus, getRecommendationStatusLabel, hasMissingDecisionData } from '@/lib/utils/recommendationDerivation';
import { previewTrade, type MockTradePreview } from '@/services/mockApi';

const PriceHistoryChart = dynamic(() => import('./PriceHistoryChart'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-white/5" />,
});

type PricePoint = {
  timestamp: string;
  price: number;
  source?: string;
};

type TokenPriceHistoryResponse = {
  data?: PricePoint[];
};

function normalizePriceHistory(history: PricePoint[] | undefined) {
  return (history ?? [])
    .filter((point) => {
      const timestamp = new Date(point.timestamp).getTime();
      return Number.isFinite(timestamp) && Number.isFinite(Number(point.price));
    })
    .map((point) => ({
      timestamp: point.timestamp,
      price: Number(point.price),
      ...(point.source ? { source: point.source } : {}),
    }));
}

export default function ScenarioPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const proposal = useProposalDetail(id);
  const timeline = useProposalTimeline(id);
  const data = proposal.data;
  const [amountUsd, setAmountUsd] = useState(100);
  const [leverage, setLeverage] = useState(1);
  const [fallbackHistory, setFallbackHistory] = useState<PricePoint[]>([]);
  const [isFallbackHistoryLoading, setIsFallbackHistoryLoading] = useState(false);
  const [preview, setPreview] = useState<MockTradePreview | null>(null);

  const timelineHistory = useMemo(
    () => normalizePriceHistory(timeline.data?.priceHistory),
    [timeline.data?.priceHistory]
  );
  const history = timelineHistory.length > 0 ? timelineHistory : fallbackHistory;

  useEffect(() => {
    if (timeline.isLoading) return;

    setFallbackHistory([]);

    if (timelineHistory.length > 0 || !data?.tokenSymbol) return;

    const controller = new AbortController();
    setIsFallbackHistoryLoading(true);

    void fetch(`/api/tokens/${encodeURIComponent(data.tokenSymbol)}/price-history`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return { data: [] };
        return response.json() as Promise<TokenPriceHistoryResponse>;
      })
      .then((body) => {
        if (!controller.signal.aborted) {
          setFallbackHistory(normalizePriceHistory(body.data));
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error('Token price history fallback failed:', error);
          setFallbackHistory([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsFallbackHistoryLoading(false);
        }
      });

    return () => controller.abort();
  }, [data?.tokenSymbol, timeline.isLoading, timelineHistory.length]);

  useEffect(() => {
    void previewTrade({ amountUsd, leverage, pnlPercentage: data?.pnlPercentage }).then(setPreview);
  }, [amountUsd, leverage, data?.pnlPercentage]);

  const expectedPnl = useMemo(() => {
    const pct = normalizePercentValue(data?.pnlPercentage ?? data?.financialImpact?.roi);
    if (pct === null) return null;
    return (amountUsd * leverage * pct) / 100;
  }, [amountUsd, leverage, data?.pnlPercentage, data?.financialImpact?.roi]);
  const netPnl = normalizePercentValue(data?.pnlPercentage ?? data?.financialImpact?.roi);
  const expired = isExpired(data?.expiresAt);
  const recommendationStatus = data ? deriveRecommendationStatus(data) : 'ACTIVE';
  const completed = recommendationStatus === 'VERIFIED';
  const executed = recommendationStatus === 'EXECUTED';
  const isArchivedRecommendation = expired || completed || executed;
  const hasUnsafeData = data ? hasMissingDecisionData(data) : false;
  const scenarioCanRouteToTrade = Boolean(data?._id && !isArchivedRecommendation && !hasUnsafeData);
  const disabledTradeLabel = expired
    ? 'Đã hết hiệu lực'
    : hasUnsafeData
      ? 'Thiếu dữ liệu để vào lệnh'
      : completed || executed
        ? 'Chỉ xem lịch sử'
        : 'Thiếu dữ liệu để vào lệnh';
  const priceDiff = data?.entryPrice !== null && data?.entryPrice !== undefined && data?.exitPrice !== null && data?.exitPrice !== undefined
    ? data.exitPrice - data.entryPrice
    : null;

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Button>

        {proposal.isLoading ? (
          <DataSkeleton rows={4} />
        ) : !data ? (
          <EmptyState title="Không tìm thấy khuyến nghị" />
        ) : (
          <>
            <PageHeader
              eyebrow="Kịch bản giao dịch"
              title={`${data.tokenSymbol ?? 'Token chưa định danh'} · Nếu vào lệnh thì điều gì có thể xảy ra?`}
              description="Đây là nơi thử số tiền và đòn bẩy trên kết quả kiểm chứng và lịch sử giá nếu có. PnL/lỗ tối đa dự kiến chỉ là mô phỏng, không phải quyết định cuối."
              actions={
                <>
                  <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                    <Link href={`/proposal/${data._id}`}>Xem chi tiết khuyến nghị</Link>
                  </Button>
                  {scenarioCanRouteToTrade ? (
                    <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                      <Link href={`/proposal/${data._id}/trade?amount=${amountUsd}&leverage=${leverage}`}>Dùng kịch bản này</Link>
                    </Button>
                  ) : (
                    <Button type="button" disabled className="bg-white/10 text-slate-400">
                      {disabledTradeLabel}
                    </Button>
                  )}
                </>
              }
            />

            {expired ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                Khuyến nghị đã hết hiệu lực và chỉ còn giá trị tham khảo.
              </div>
            ) : completed ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Khuyến nghị đã có kết quả kiểm chứng, không còn là cơ hội hành động mới.
              </div>
            ) : executed ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Khuyến nghị ở trạng thái {getRecommendationStatusLabel(recommendationStatus).toLowerCase()}. Kịch bản này chỉ dùng để tham khảo, không mở luồng vào lệnh mới.
              </div>
            ) : hasUnsafeData ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Thiếu dữ liệu giá, nguồn hoặc độ tin cậy. Hãy theo dõi thêm trước khi giao dịch.
              </div>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-3">
              <Panel title="Kết quả kiểm chứng">
                <Mini label="Trạng thái" value={data.winLossStatus ?? 'Chưa kiểm chứng'} />
                <Mini label="Giá vào" value={formatCurrency(data.entryPrice)} />
                <Mini label="Giá ra" value={formatCurrency(data.exitPrice)} />
                <Mini label="PnL trước phí" value={formatPercent(normalizePercentValue(data.backtestMeta?.grossPnlPercentage))} />
                <Mini label="PnL sau phí" value={netPnl === null ? 'Chưa kiểm chứng' : formatPercent(netPnl)} />
                <Mini label="PnL thực tế" value={formatCurrency(data.actualPnL)} />
                <Mini label="Tỷ lệ phí" value={formatPercent(normalizePercentValue(data.backtestMeta?.feeRate))} />
                <Mini label="Tỷ lệ trượt giá" value={formatPercent(normalizePercentValue(data.backtestMeta?.slippageRate))} />
                <Mini label="Giá trị danh nghĩa" value={formatCurrency(data.backtestMeta?.notionalUsd)} />
                <Mini label="Chất lượng dữ liệu" value={data.backtestMeta?.dataQuality ?? 'Chưa có dữ liệu'} />
              </Panel>

              <Panel title="So sánh giá">
                <Mini label="Giá lúc phát hiện" value={formatCurrency(data.entryPrice)} />
                <Mini label="Giá lúc hết hạn" value={formatCurrency(data.exitPrice)} />
                <Mini label="Chênh lệch giá" value={priceDiff === null ? 'Chưa có dữ liệu' : formatCurrency(priceDiff)} />
                <Mini label="Phát hiện lúc" value={formatVietnameseDateTime(data.backtestMeta?.detectedAt)} />
                <Mini label="Vào lệnh lúc" value={formatVietnameseDateTime(data.backtestMeta?.entryTimestamp)} />
                <Mini label="Kết thúc lúc" value={formatVietnameseDateTime(data.backtestMeta?.exitTimestamp)} />
              </Panel>

              <Panel title="Mô phỏng theo số tiền">
                <label className="text-sm text-slate-300">
                  Số tiền USD
                  <input value={amountUsd} onChange={(event) => setAmountUsd(Number(event.target.value || 0))} type="number" min="10" className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white outline-none focus:border-cyan-500" />
                </label>
                <label className="text-sm text-slate-300">
                  Đòn bẩy
                  <select value={leverage} onChange={(event) => setLeverage(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white outline-none focus:border-cyan-500">
                    {[1, 2, 5].map((item) => <option key={item} value={item}>{item}x</option>)}
                  </select>
                </label>
                <Mini label="Giá trị danh nghĩa" value={formatCurrency(preview?.notionalUsd)} />
                <Mini label="Lỗ tối đa mô phỏng" value={formatCurrency(preview?.maxLossUsd)} />
                <Mini label="PnL kỳ vọng mô phỏng" value={expectedPnl === null ? 'Chưa có kết quả kiểm chứng để mô phỏng PnL' : formatCurrency(expectedPnl)} />
              </Panel>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Giá lịch sử</h2>
              <p className="mt-1 text-sm text-slate-500">Ưu tiên dữ liệu theo dòng thời gian của khuyến nghị; nếu thiếu sẽ thử lịch sử giá theo token.</p>
              <div className="mt-5 h-72">
                {timeline.isLoading || isFallbackHistoryLoading ? (
                  <div className="h-full w-full animate-pulse rounded-lg bg-white/5" />
                ) : history.length > 0 ? (
                  <PriceHistoryChart history={history} />
                ) : (
                  <EmptyState title="Chưa có lịch sử giá" description="Chưa đủ dữ liệu giá để vẽ biểu đồ cho khuyến nghị này." />
                )}
              </div>
            </section>
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
