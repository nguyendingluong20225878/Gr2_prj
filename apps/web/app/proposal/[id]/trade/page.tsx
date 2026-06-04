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
import { previewTrade, type MockTradePreview } from '@/services/mockApi';

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
  const [preview, setPreview] = useState<MockTradePreview | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const direction = useMemo(() => {
    const action = String(data?.action ?? data?.suggestionType ?? 'BUY').toUpperCase();
    return action === 'SELL' ? 'SHORT' : 'LONG';
  }, [data?.action, data?.suggestionType]);

  useEffect(() => {
    void previewTrade({ amountUsd, leverage, pnlPercentage: data?.pnlPercentage }).then(setPreview);
  }, [amountUsd, leverage, data?.pnlPercentage]);

  const executeTrade = async () => {
    if (!data) return;
    if (!user) {
      toast.error('Vui lòng kết nối ví trước khi vào lệnh.');
      return;
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
      if (!response.ok) throw new Error(body.error || 'Không execute được giao dịch');
      toast.success('Đã xác nhận vào lệnh.');
      router.push('/positions');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không execute được giao dịch');
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
          <EmptyState title="Không tìm thấy đề xuất" />
        ) : (
          <>
            <PageHeader
              eyebrow="Xác nhận giao dịch"
              title={`${data.tokenSymbol ?? 'TOKEN'} · ${direction}`}
              description="Xác nhận size, Leverage, direction và risk plan trước khi gọi `/api/trade/execute`."
              actions={
                <>
                  <Button asChild variant="outline" className="border-white/10">
                    <Link href={`/proposal/${data._id}`}>Quay lại đề xuất</Link>
                  </Button>
                  <Button onClick={markWait} variant="outline" className="border-cyan-500/30 text-cyan-300">Chỉ theo dõi</Button>
                  <Button onClick={executeTrade} disabled={submitting || isExpired(data.expiresAt)} className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Xác nhận vào lệnh
                  </Button>
                </>
              }
            />

            {isExpired(data.expiresAt) ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                Proposal đã hết hạn. Không nên execute giao dịch nếu chưa refresh dữ liệu.
              </div>
            ) : null}

            {data.executionStatus && data.executionStatus !== 'PENDING' ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Execution status hiện tại: {data.executionStatus}. Hãy kiểm tra trước khi vào lệnh.
              </div>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-3">
              <Panel title="Thông tin lệnh">
                <Mini label="Token" value={data.tokenSymbol ?? 'TOKEN'} />
                <Mini label="Direction" value={direction} />
                <Mini label="Hành động đề xuất" value={toDisplayAction(data.action ?? data.suggestionType)} />
                <Mini label="Entry price" value={formatCurrency(data.entryPrice ?? data.financialImpact?.currentPrice ?? data.financialImpact?.currentValue)} />
                <Mini label="Hiệu lực" value={<CountdownBadge value={data.expiresAt} />} />
              </Panel>

              <Panel title="Size và Leverage">
                <label className="text-sm text-slate-300">
                  Amount USD
                  <input value={amountUsd} onChange={(event) => setAmountUsd(Number(event.target.value || 0))} type="number" min="10" className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white outline-none focus:border-cyan-500" />
                </label>
                <label className="text-sm text-slate-300">
                  Leverage
                  <select value={leverage} onChange={(event) => setLeverage(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white outline-none focus:border-cyan-500">
                    {[1, 2, 5, 10].map((item) => <option key={item} value={item}>{item}x</option>)}
                  </select>
                </label>
                <Mini label="Notional USD" value={formatCurrency(preview?.notionalUsd)} />
              </Panel>

              <Panel title="Risk plan">
                <Mini label="Recommended size" value={formatCurrency(preview?.recommendedSizeUsd)} />
                <Mini label="Max loss" value={formatCurrency(preview?.maxLossUsd)} />
                <Mini label="Risk per trade" value={`${preview?.riskPerTradePct ?? 'N/A'}%`} />
                <Mini label="Stop loss" value={`${preview?.stopLossPct ?? 'N/A'}%`} />
              </Panel>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Proposal summary</h2>
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
