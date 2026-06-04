'use client';

import Link from 'next/link';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { DataQualityBadge, DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useNdlData } from '@/lib/hooks/useNdlData';
import { formatVietnameseDateTime, formatExpiry } from '@/lib/utils/time';

export default function DataCheckPage() {
  const { portfolio, proposals, signals, modelHealth } = useNdlData();
  const latestSignal = signals.data?.[0];
  const latestProposal = proposals.data?.[0];
  const missingPrices = (portfolio.data?.holdings ?? []).filter((holding) => holding.dataQuality === 'MISSING_PRICE');

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Kiểm tra dữ liệu và thời gian"
          title="Recommendation có dựa trên dữ liệu mới không?"
          description="Tổng hợp wallet sync, price quality, Signal lifecycle, proposal expiry, Backtest và model config để tránh quyết định dựa trên dữ liệu cũ."
          actions={
            <>
              <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white"><Link href="/recommendations">Dữ liệu ổn</Link></Button>
              <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300"><Link href="/model-health">Xem sức khỏe mô hình</Link></Button>
            </>
          }
        />

        {portfolio.isLoading || proposals.isLoading || signals.isLoading || modelHealth.isLoading ? (
          <DataSkeleton rows={4} />
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-3">
              <Panel title="Wallet và giá">
                <Mini label="Wallet sync time" value="Chưa có field sync time từ BE" />
                <Mini label="Holdings thiếu giá" value={missingPrices.length} />
                <div className="space-y-2">
                  {(portfolio.data?.holdings ?? []).slice(0, 6).map((holding) => (
                    <div key={holding.symbol} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/40 px-3 py-2">
                      <span className="text-sm text-slate-300">{holding.symbol}</span>
                      <DataQualityBadge value={holding.dataQuality} />
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Signal mới nhất">
                {latestSignal ? (
                  <>
                    <Mini label="Token" value={latestSignal.tokenSymbol ?? 'TOKEN'} />
                    <Mini label="Detected at" value={formatVietnameseDateTime(latestSignal.detectedAt)} />
                    <Mini label="Expires at" value={formatVietnameseDateTime(latestSignal.expiresAt)} />
                    <Mini label="Countdown" value={formatExpiry(latestSignal.expiresAt)} />
                    <Mini label="Signal mode" value={latestSignal.metadata?.isNewToken ? 'COLD_START' : 'NORMALIZED_ALPHA'} />
                    <Mini label="Data quality" value={`Sample size ${latestSignal.metadata?.sampleSize ?? 'N/A'}`} />
                  </>
                ) : <EmptyState title="Chưa có Signal" />}
              </Panel>

              <Panel title="Proposal và Backtest">
                {latestProposal ? (
                  <>
                    <Mini label="Token" value={latestProposal.tokenSymbol ?? 'TOKEN'} />
                    <Mini label="Created at" value={formatVietnameseDateTime(latestProposal.createdAt)} />
                    <Mini label="Expires at" value={formatVietnameseDateTime(latestProposal.expiresAt)} />
                    <Mini label="Backtested at" value={formatVietnameseDateTime(latestProposal.backtestedAt)} />
                    <Mini label="Backtest quality" value={latestProposal.backtestMeta?.dataQuality ?? 'Chưa có dữ liệu'} />
                  </>
                ) : <EmptyState title="Chưa có Proposal" />}
              </Panel>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Model config</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Mini label="Status" value={modelHealth.data?.activeConfig?.status ?? 'N/A'} />
                <Mini label="Updated at" value={formatVietnameseDateTime(modelHealth.data?.activeConfig?.updatedAt)} />
                <Mini label="Promoted at" value={formatVietnameseDateTime(modelHealth.data?.activeConfig?.promotedAt)} />
                <Mini label="Latency" value={`${modelHealth.data?.latencyMs ?? 'N/A'} ms`} />
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
