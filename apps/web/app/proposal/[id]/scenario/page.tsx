'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/app/components/layout/Layout';
import { ProposalFlowNav } from '@/app/components/proposal/ProposalFlowNav';
import { Button } from '@/app/components/ui/button';
import { CountdownBadge, DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useAuth } from '@/app/contexts/AuthContext';
import { useProposalDetail, useProposalTimeline } from '@/lib/hooks/useNdlData';
import { formatCurrency, formatPercent, normalizePercentValue, toDisplayAction } from '@/lib/utils/formatters';
import { formatVietnameseDateTime, isExpired } from '@/lib/utils/time';
import { deriveRecommendationStatus, getRecommendationStatusLabel, hasMissingDecisionData } from '@/lib/utils/recommendationDerivation';

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

type TradePreview = {
  status: 'OK' | 'LIMITED';
  warning?: string | null;
  warnings?: string[];
  recommendedSizeUsd: number | null;
  maxLossUsd: number | null;
  riskPerTradePct: number | null;
  stopLossPct: number | null;
  notionalUsd: number | null;
  leverage: number;
  estimatedFeeUsd: number | null;
  estimatedSlippageUsd: number | null;
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
  const { user } = useAuth();
  const proposal = useProposalDetail(id);
  const timeline = useProposalTimeline(id);
  const data = proposal.data;
  const [amountUsd, setAmountUsd] = useState(100);
  const [leverage, setLeverage] = useState(1);
  const [fallbackHistory, setFallbackHistory] = useState<PricePoint[]>([]);
  const [isFallbackHistoryLoading, setIsFallbackHistoryLoading] = useState(false);
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const expectedPnl = useMemo(() => {
    const pct = normalizePercentValue(data?.pnlPercentage ?? data?.financialImpact?.roi);
    if (pct === null) return null;
    return (amountUsd * leverage * pct) / 100;
  }, [amountUsd, leverage, data?.pnlPercentage, data?.financialImpact?.roi]);
  const notionalUsd = useMemo(() => amountUsd * leverage, [amountUsd, leverage]);
  const netPnl = normalizePercentValue(data?.pnlPercentage ?? data?.financialImpact?.roi);
  const expired = isExpired(data?.expiresAt);
  const recommendationStatus = data ? deriveRecommendationStatus(data) : 'ACTIVE';
  const completed = recommendationStatus === 'VERIFIED';
  const executed = recommendationStatus === 'EXECUTED';
  const isArchivedRecommendation = expired || completed || executed;
  const hasUnsafeData = false;// data ? hasMissingDecisionData(data) :
  const previewUnavailable = Boolean(data?._id && (!preview || previewError));
  const executionDisabled = Boolean(submitting || isArchivedRecommendation || hasUnsafeData || previewUnavailable);
  const disabledTradeLabel = expired
    ? 'Đã hết hiệu lực'
    : hasUnsafeData
      ? 'Thiếu dữ liệu để vào lệnh'
      : completed || executed
        ? 'Chỉ xem lịch sử'
        : 'Thiếu dữ liệu để vào lệnh';
  const direction = useMemo(() => {
    const action = String(data?.action ?? data?.suggestionType ?? 'BUY').toUpperCase();
    return action === 'SELL' ? 'SHORT' : 'LONG';
  }, [data?.action, data?.suggestionType]);
  const priceDiff = data?.entryPrice !== null && data?.entryPrice !== undefined && data?.exitPrice !== null && data?.exitPrice !== undefined
    ? data.exitPrice - data.entryPrice
    : null;

  useEffect(() => {
    if (!data?._id) return;
    if (isArchivedRecommendation || hasUnsafeData) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    const controller = new AbortController();
    setPreviewError(null);

    void fetch('/api/trade/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        proposalId: data._id,
        amountUsd,
        leverage,
        entryPrice: data.entryPrice ?? data.financialImpact?.currentPrice ?? null,
        direction,
      }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Không tải được kế hoạch rủi ro');
        return body as TradePreview;
      })
      .then(setPreview)
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setPreview(null);
        setPreviewError(error instanceof Error ? error.message : 'Không tải được kế hoạch rủi ro');
      });

    return () => controller.abort();
  }, [amountUsd, data?._id, data?.entryPrice, data?.financialImpact?.currentPrice, direction, hasUnsafeData, isArchivedRecommendation, leverage]);

  const executeTrade = async () => {
    if (!data) return;
    if (!user) {
      toast.error('Vui lòng kết nối ví trước khi xác nhận lệnh demo.');
      return;
    }
    if (isArchivedRecommendation) {
      toast.error('Khuyến nghị này không còn là cơ hội hành động mới. Hãy xem như dữ liệu tham khảo.');
      return;
    }
    if (hasMissingDecisionData(data)) {
      toast.error('Thiếu dữ liệu giá, nguồn hoặc độ tin cậy. Hãy theo dõi thêm trước khi xác nhận lệnh demo.');
      return;
    }
    if (isExpired(data.expiresAt)) {
      toast.error('Khuyến nghị đã hết hiệu lực. Hãy cập nhật dữ liệu trước khi xác nhận lệnh demo.');
      return;
    }
    if (previewError || !preview) {
      toast.error('Chưa xác nhận được kế hoạch rủi ro. NDL đã chặn lệnh demo cho tới khi dữ liệu đủ hơn.');
      return;
    }
    if (preview.status === 'LIMITED') {
      const accepted = window.confirm('Dữ liệu rủi ro đang hạn chế. Bạn vẫn muốn xác nhận lệnh demo với trách nhiệm tự chịu rủi ro?');
      if (!accepted) return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/trade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: data._id,
          tokenSymbol: data.tokenSymbol,
          tokenAddress: data.tokenAddress,
          amount: amountUsd,
          entryPrice: data.entryPrice ?? data.financialImpact?.currentPrice ?? data.financialImpact?.currentValue,
          direction,
          leverage,
          riskPlan: {
            maxLossUsd: preview.maxLossUsd,
            recommendedSizeUsd: preview.recommendedSizeUsd,
            riskPerTradePct: preview.riskPerTradePct,
            stopLossPct: preview.stopLossPct,
          },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(getDemoTradeErrorMessage(body.error));
      toast.success('Đã xác nhận lệnh demo.');
      router.push('/positions');
    } catch (error) {
      toast.error(error instanceof Error ? getDemoTradeErrorMessage(error.message) : 'Không xác nhận được lệnh demo');
    } finally {
      setSubmitting(false);
    }
  };

  const markWait = async () => {
    if (!data) return;
    const response = await fetch(`/api/proposals/${data._id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'WAIT', reason: 'Chỉ theo dõi, chưa xác nhận lệnh demo' }),
    });
    if (response.ok) toast.success('Đã chuyển sang theo dõi.');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Button>
        <ProposalFlowNav proposalId={id} activeStep="scenario" />

        {proposal.isLoading ? (
          <DataSkeleton rows={4} />
        ) : !data ? (
          <EmptyState title="Không tìm thấy khuyến nghị" />
        ) : (
          <>
            <PageHeader
              eyebrow="Kịch bản & Trade Demo"
              title={`${data.tokenSymbol ?? 'Token chưa định danh'} · Xác nhận lệnh mô phỏng`}
              description="1. Nhập số tiền / đòn bẩy. 2. Xem PnL mô phỏng + rủi ro. 3. Nếu ổn thì bấm 'Xác nhận lệnh demo'."
              actions={
                <>
                  <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                    <Link href={`/proposal/${data._id}`}>Xem chi tiết khuyến nghị</Link>
                  </Button>
                  {!isArchivedRecommendation && !hasUnsafeData ? (
                    <>
                      <Button onClick={markWait} variant="outline" className="border-cyan-500/30 text-cyan-300">Chỉ theo dõi</Button>
                      <Button onClick={executeTrade} disabled={executionDisabled} className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Xác nhận lệnh demo
                      </Button>
                    </>
                  ) : (
                    <Button type="button" disabled className="bg-white/10 text-slate-400">
                      {disabledTradeLabel}
                    </Button>
                  )}
                </>
              }
            />

            <section className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  step: '1',
                  title: 'Nhập số tiền / đòn bẩy',
                  description: 'Chọn số tiền USD và tỷ lệ đòn bẩy để xây dựng kịch bản demo.',
                },
                {
                  step: '2',
                  title: 'Xem PnL mô phỏng + rủi ro',
                  description: 'NDL tính giá trị danh nghĩa, rủi ro mỗi lệnh và lỗ tối đa dự kiến.',
                },
                {
                  step: '3',
                  title: 'Xác nhận lệnh demo',
                  description: 'Nếu kết quả hợp lý, bấm để tạo lệnh demo và theo dõi vị thế mô phỏng.',
                },
              ].map((item) => (
                <div key={item.step} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-3 text-sm font-semibold text-cyan-100">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/15">{item.step}</span>
                    <span>{item.title}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.description}</p>
                </div>
              ))}
            </section>

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

            {previewError ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {previewError}. NDL đã tắt xác nhận lệnh demo cho tới khi tải được kế hoạch rủi ro.
              </div>
            ) : preview?.status === 'LIMITED' && preview.warning ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {preview.warning}
              </div>
            ) : null}

            {/* Debug Section */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 text-xs">
              <p className="mb-2 font-semibold text-slate-300">🔍 Debug Preview API</p>
              <div className="space-y-1 font-mono text-slate-400">
                <p>Proposal ID: <span className="text-cyan-300">{data?._id ? '✓' : '✗'}</span></p>
                <p>Archived (expired/completed/executed): <span className={isArchivedRecommendation ? 'text-red-300' : 'text-green-300'}>{isArchivedRecommendation ? 'YES (API blocked)' : 'NO'}</span></p>
                <p>Unsafe Data (missing critical fields): <span className={hasUnsafeData ? 'text-red-300' : 'text-green-300'}>{hasUnsafeData ? 'YES (API blocked)' : 'NO'}</span></p>
                <p>Preview Status: <span className={preview ? 'text-green-300' : previewError ? 'text-red-300' : 'text-yellow-300'}>{preview ? `OK - ${preview.status}` : previewError ? `ERROR: ${previewError}` : 'Loading or not called'}</span></p>
                <p>Entry Price: <span className="text-cyan-300">{data?.entryPrice ?? data?.financialImpact?.currentPrice ?? 'null'}</span></p>
                <p>Direction: <span className="text-cyan-300">{direction}</span></p>
              </div>
            </div>

            <section className="grid gap-4 lg:grid-cols-3">
              <Panel title="1. Nhập số tiền / đòn bẩy">
                <label className="text-sm text-slate-300">
                  Số tiền USD
                  <input value={amountUsd} onChange={(event) => setAmountUsd(Number(event.target.value || 0))} type="number" min="10" className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white outline-none focus:border-cyan-500" />
                </label>
                <label className="text-sm text-slate-300">
                  Đòn bẩy
                  <select value={leverage} onChange={(event) => setLeverage(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white outline-none focus:border-cyan-500">
                    {[1, 2, 5, 10].map((item) => <option key={item} value={item}>{item}x</option>)}
                  </select>
                </label>
                <Mini label="Giá trị danh nghĩa" value={formatCurrency(preview?.notionalUsd ?? notionalUsd)} />
                <Mini label="PnL kỳ vọng mô phỏng" value={expectedPnl === null ? 'Chưa có kết quả kiểm chứng để mô phỏng PnL' : formatCurrency(expectedPnl)} />
              </Panel>

              <Panel title="2. Xem PnL mô phỏng + rủi ro">
                <Mini label="Quy mô gợi ý" value={formatCurrency(preview?.recommendedSizeUsd)} />
                <Mini label="Lỗ tối đa" value={formatCurrency(preview?.maxLossUsd)} />
                <Mini label="Rủi ro mỗi lệnh" value={preview?.riskPerTradePct === null || preview?.riskPerTradePct === undefined ? 'Chưa có dữ liệu' : `${preview.riskPerTradePct}%`} />
                <Mini label="Stop loss" value={preview?.stopLossPct === null || preview?.stopLossPct === undefined ? 'Chưa có dữ liệu' : `${preview.stopLossPct}%`} />
                <Mini label="Phí dự kiến" value={formatCurrency(preview?.estimatedFeeUsd)} />
                <Mini label="Trượt giá dự kiến" value={formatCurrency(preview?.estimatedSlippageUsd)} />
              </Panel>

              <Panel title="3. Xác nhận lệnh demo">
                <Mini label="Token" value={data.tokenSymbol ?? 'Token chưa định danh'} />
                <Mini label="Hướng lệnh demo" value={direction} />
                <Mini label="Hành động khuyến nghị" value={toDisplayAction(data.action ?? data.suggestionType)} />
                <Mini label="Giá vào" value={formatCurrency(data.entryPrice ?? data.financialImpact?.currentPrice ?? data.financialImpact?.currentValue)} />
                <Mini label="Hiệu lực" value={<CountdownBadge value={data.expiresAt} />} />
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

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Tóm tắt khuyến nghị</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{data.summary ?? data.rationaleSummary ?? 'Chưa có dữ liệu.'}</p>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function getDemoTradeErrorMessage(message?: unknown) {
  const fallback = 'Không xác nhận được lệnh demo';
  if (typeof message !== 'string' || !message.trim()) return fallback;
  return message
    .replace(/giao dịch/gi, 'lệnh demo')
    .replace(/vào lệnh/gi, 'xác nhận lệnh demo');
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
