'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { CountdownBadge, DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useAuth } from '@/app/contexts/AuthContext';
import { useProposalDetail } from '@/lib/hooks/useNdlData';
import { formatCurrency, toDisplayAction } from '@/lib/utils/formatters';
import { isExpired } from '@/lib/utils/time';
import { deriveRecommendationStatus, getRecommendationStatusLabel, hasMissingDecisionData } from '@/lib/utils/recommendationDerivation';

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

export default function TradeConfirmPage() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();
  const id = String(params.id ?? '');
  const { user } = useAuth();
  const proposal = useProposalDetail(id);
  const data = proposal.data;
  const [amountUsd, setAmountUsd] = useState(Number(search.get('amount') ?? 100));
  const [leverage, setLeverage] = useState(Number(search.get('leverage') ?? 1));
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const recommendationStatus = data ? deriveRecommendationStatus(data) : 'ACTIVE';
  const expired = isExpired(data?.expiresAt);
  const completed = recommendationStatus === 'VERIFIED';
  const executed = recommendationStatus === 'EXECUTED';
  const isArchivedRecommendation = expired || completed || executed;
  const hasUnsafeData = data ? hasMissingDecisionData(data) : false;
  const previewUnavailable = Boolean(data?._id && (!preview || previewError));
  const executionDisabled = Boolean(submitting || isArchivedRecommendation || hasUnsafeData || previewUnavailable);

  const direction = useMemo(() => {
    const action = String(data?.action ?? data?.suggestionType ?? 'BUY').toUpperCase();
    return action === 'SELL' ? 'SHORT' : 'LONG';
  }, [data?.action, data?.suggestionType]);

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
        if (!response.ok) throw new Error(body.error || 'Không tải được risk preview');
        return body as TradePreview;
      })
      .then(setPreview)
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setPreview(null);
        setPreviewError(error instanceof Error ? error.message : 'Không tải được risk preview');
      });

    return () => controller.abort();
  }, [amountUsd, data?._id, data?.entryPrice, data?.financialImpact?.currentPrice, direction, hasUnsafeData, isArchivedRecommendation, leverage]);

  const executeTrade = async () => {
    if (!data) return;
    if (!user) {
      toast.error('Vui lòng kết nối ví trước khi vào lệnh.');
      return;
    }
    if (isArchivedRecommendation) {
      toast.error('Khuyến nghị này không còn là cơ hội hành động mới. Hãy xem như dữ liệu tham khảo.');
      return;
    }
    if (hasMissingDecisionData(data)) {
      toast.error('Thiếu dữ liệu giá, nguồn hoặc độ tin cậy. Hãy theo dõi thêm trước khi giao dịch.');
      return;
    }
    if (isExpired(data.expiresAt)) {
      toast.error('Khuyến nghị đã hết hiệu lực. Hãy cập nhật dữ liệu trước khi vào lệnh.');
      return;
    }
    if (previewError || !preview) {
      toast.error('Chưa xác nhận được kế hoạch rủi ro. NDL đã chặn vào lệnh cho tới khi dữ liệu đủ hơn.');
      return;
    }
    if (preview?.status === 'LIMITED') {
      const accepted = window.confirm('Dữ liệu rủi ro đang hạn chế. Bạn vẫn muốn xác nhận vào lệnh với trách nhiệm tự chịu rủi ro?');
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
            maxLossUsd: preview?.maxLossUsd,
            recommendedSizeUsd: preview?.recommendedSizeUsd,
            riskPerTradePct: preview?.riskPerTradePct,
            stopLossPct: preview?.stopLossPct,
          },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Không xác nhận được giao dịch');
      toast.success('Đã xác nhận vào lệnh.');
      router.push('/positions');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không xác nhận được giao dịch');
    } finally {
      setSubmitting(false);
    }
  };

  const markWait = async () => {
    if (!data) return;
    const response = await fetch(`/api/proposals/${data._id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'WAIT', reason: 'Chỉ theo dõi, chưa vào lệnh' }),
    });
    if (response.ok) toast.success('Đã chuyển sang theo dõi.');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Button>

        {proposal.isLoading ? (
          <DataSkeleton rows={3} />
        ) : !data ? (
          <EmptyState title="Không tìm thấy khuyến nghị" />
        ) : (
          <>
            <PageHeader
              eyebrow="Xác nhận giao dịch"
              title={`${data.tokenSymbol ?? 'Token chưa định danh'} · ${direction}`}
              description="Xác nhận quy mô, đòn bẩy, hướng giao dịch và kế hoạch rủi ro trước khi vào lệnh."
              actions={
                <>
                  <Button asChild variant="outline" className="border-white/10">
                    <Link href={`/proposal/${data._id}`}>Quay lại khuyến nghị</Link>
                  </Button>
                  <Button onClick={markWait} variant="outline" className="border-cyan-500/30 text-cyan-300">Chỉ theo dõi</Button>
                  <Button onClick={executeTrade} disabled={executionDisabled} className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Xác nhận vào lệnh
                  </Button>
                </>
              }
            />

            {isExpired(data.expiresAt) ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                Khuyến nghị đã hết hiệu lực và chỉ còn giá trị tham khảo.
              </div>
            ) : null}

            {completed ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Khuyến nghị đã có kết quả kiểm chứng, không còn là cơ hội hành động mới.
              </div>
            ) : executed ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Khuyến nghị ở trạng thái {getRecommendationStatusLabel(recommendationStatus).toLowerCase()}. NDL đã chặn xác nhận vào lệnh để tránh trình bày dữ liệu cũ như cơ hội mới.
              </div>
            ) : null}

            {hasUnsafeData ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Thiếu dữ liệu giá, nguồn hoặc độ tin cậy. Hãy theo dõi thêm trước khi giao dịch.
              </div>
            ) : null}

            {data.executionStatus && data.executionStatus !== 'PENDING' ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Trạng thái giao dịch hiện tại: {data.executionStatus}. Hãy kiểm tra trước khi vào lệnh.
              </div>
            ) : null}

            {previewError ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {previewError}. NDL đã tắt xác nhận vào lệnh cho tới khi tải được kế hoạch rủi ro.
              </div>
            ) : preview?.status === 'LIMITED' && preview.warning ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {preview.warning}
              </div>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-3">
              <Panel title="Thông tin lệnh">
                <Mini label="Token" value={data.tokenSymbol ?? 'Token chưa định danh'} />
                <Mini label="Hướng giao dịch" value={direction} />
                <Mini label="Hành động khuyến nghị" value={toDisplayAction(data.action ?? data.suggestionType)} />
                <Mini label="Giá vào" value={formatCurrency(data.entryPrice ?? data.financialImpact?.currentPrice ?? data.financialImpact?.currentValue)} />
                <Mini label="Hiệu lực" value={<CountdownBadge value={data.expiresAt} />} />
              </Panel>

              <Panel title="Quy mô và đòn bẩy">
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
                <Mini label="Giá trị danh nghĩa" value={formatCurrency(preview?.notionalUsd)} />
              </Panel>

              <Panel title="Kế hoạch rủi ro">
                <Mini label="Quy mô gợi ý" value={formatCurrency(preview?.recommendedSizeUsd)} />
                <Mini label="Lỗ tối đa" value={formatCurrency(preview?.maxLossUsd)} />
                <Mini label="Rủi ro mỗi lệnh" value={preview?.riskPerTradePct === null || preview?.riskPerTradePct === undefined ? 'Chưa có dữ liệu' : `${preview.riskPerTradePct}%`} />
                <Mini label="Stop loss" value={preview?.stopLossPct === null || preview?.stopLossPct === undefined ? 'Chưa có dữ liệu' : `${preview.stopLossPct}%`} />
                <Mini label="Phí dự kiến" value={formatCurrency(preview?.estimatedFeeUsd)} />
                <Mini label="Trượt giá dự kiến" value={formatCurrency(preview?.estimatedSlippageUsd)} />
              </Panel>
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
