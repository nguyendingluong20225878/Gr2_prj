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
import { useProposalDetail } from '@/lib/hooks/useNdlData';
import { formatCurrency, formatPercent, normalizePercentValue } from '@/lib/utils/formatters';
import { formatVietnameseDateTime } from '@/lib/utils/time';
import { getMockPriceHistory, previewTrade, type MockPricePoint, type MockTradePreview } from '@/services/mockApi';

const PriceHistoryChart = dynamic(() => import('./PriceHistoryChart'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-white/5" />,
});

export default function ScenarioPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const proposal = useProposalDetail(id);
  const data = proposal.data;
  const [amountUsd, setAmountUsd] = useState(100);
  const [leverage, setLeverage] = useState(1);
  const [history, setHistory] = useState<MockPricePoint[]>([]);
  const [preview, setPreview] = useState<MockTradePreview | null>(null);

  useEffect(() => {
    if (!data?.tokenSymbol) return;
    void getMockPriceHistory(data.tokenSymbol).then(setHistory);
  }, [data?.tokenSymbol]);

  useEffect(() => {
    void previewTrade({ amountUsd, leverage, pnlPercentage: data?.pnlPercentage }).then(setPreview);
  }, [amountUsd, leverage, data?.pnlPercentage]);

  const expectedPnl = useMemo(() => {
    const pct = normalizePercentValue(data?.pnlPercentage ?? data?.financialImpact?.roi);
    if (pct === null) return null;
    return (amountUsd * leverage * pct) / 100;
  }, [amountUsd, leverage, data?.pnlPercentage, data?.financialImpact?.roi]);
  const netPnl = normalizePercentValue(data?.pnlPercentage ?? data?.financialImpact?.roi);
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
          <EmptyState title="Không tìm thấy đề xuất" />
        ) : (
          <>
            <PageHeader
              eyebrow="So sánh quá khứ & kịch bản giao dịch"
              title={`${data.tokenSymbol ?? 'TOKEN'} · Backtest và kịch bản`}
              description="Thay thế mô phỏng chiến lược realtime bằng dữ liệu backend đã có: Backtest, PnL, ROI, Entry/Exit, fee và slippage. Chart giá dùng mock service vì API price-history chưa có."
              actions={
                <>
                  <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                    <Link href={`/proposal/${data._id}`}>Xem chi tiết đề xuất</Link>
                  </Button>
                  <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                    <Link href={`/proposal/${data._id}/trade?amount=${amountUsd}&leverage=${leverage}`}>Dùng kịch bản này</Link>
                  </Button>
                </>
              }
            />

            <section className="grid gap-4 lg:grid-cols-3">
              <Panel title="Kết quả Backtest">
                <Mini label="Trạng thái" value={data.winLossStatus ?? 'Chưa backtest'} />
                <Mini label="Entry price" value={formatCurrency(data.entryPrice)} />
                <Mini label="Exit price" value={formatCurrency(data.exitPrice)} />
                <Mini label="Gross PnL" value={formatPercent(normalizePercentValue(data.backtestMeta?.grossPnlPercentage))} />
                <Mini label="Net PnL" value={netPnl === null ? 'Chưa backtest' : formatPercent(netPnl)} />
                <Mini label="Actual PnL" value={formatCurrency(data.actualPnL)} />
                <Mini label="Fee rate" value={formatPercent(normalizePercentValue(data.backtestMeta?.feeRate))} />
                <Mini label="Slippage rate" value={formatPercent(normalizePercentValue(data.backtestMeta?.slippageRate))} />
                <Mini label="Notional USD" value={formatCurrency(data.backtestMeta?.notionalUsd)} />
                <Mini label="Data quality" value={data.backtestMeta?.dataQuality ?? 'Chưa có dữ liệu'} />
              </Panel>

              <Panel title="So sánh giá">
                <Mini label="Giá lúc phát hiện" value={formatCurrency(data.entryPrice)} />
                <Mini label="Giá lúc hết hạn" value={formatCurrency(data.exitPrice)} />
                <Mini label="Chênh lệch giá" value={priceDiff === null ? 'Chưa có dữ liệu' : formatCurrency(priceDiff)} />
                <Mini label="Detected at" value={formatVietnameseDateTime(data.backtestMeta?.detectedAt)} />
                <Mini label="Entry timestamp" value={formatVietnameseDateTime(data.backtestMeta?.entryTimestamp)} />
                <Mini label="Exit timestamp" value={formatVietnameseDateTime(data.backtestMeta?.exitTimestamp)} />
              </Panel>

              <Panel title="Kịch bản FE-only">
                <label className="text-sm text-slate-300">
                  Size USD
                  <input value={amountUsd} onChange={(event) => setAmountUsd(Number(event.target.value || 0))} type="number" min="10" className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white outline-none focus:border-cyan-500" />
                </label>
                <label className="text-sm text-slate-300">
                  Leverage
                  <select value={leverage} onChange={(event) => setLeverage(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white outline-none focus:border-cyan-500">
                    {[1, 2, 5].map((item) => <option key={item} value={item}>{item}x</option>)}
                  </select>
                </label>
                <Mini label="Notional USD" value={formatCurrency(preview?.notionalUsd)} />
                <Mini label="Max loss" value={formatCurrency(preview?.maxLossUsd)} />
                <Mini label="PnL kỳ vọng" value={formatCurrency(expectedPnl)} />
              </Panel>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Giá lịch sử</h2>
              <p className="mt-1 text-sm text-slate-500">Dữ liệu tạm từ `services/mockApi.ts`, thay bằng `/api/tokens/:tokenSymbol/price-history` khi BE có API.</p>
              <div className="mt-5 h-72">
                <PriceHistoryChart history={history} />
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
