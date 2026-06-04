'use client';

import Link from 'next/link';
import type React from 'react';
import { Layout } from '@/app/components/layout/Layout';
import { Badge } from '@/app/components/ui/badge';
import { DataSkeleton, EmptyState, MetricCard, PageHeader } from '@/app/components/shared/NdlUi';
import { useNdlData } from '@/lib/hooks/useNdlData';
import { formatCurrency, formatPercent, normalizePercentValue } from '@/lib/utils/formatters';
import { getLatestActiveProposalPerToken } from '@/lib/utils/proposals';

export default function PositionsPage() {
  const { portfolio, proposals } = useNdlData();
  const positions = portfolio.data?.investments ?? [];
  const activeProposalSymbols = new Set(getLatestActiveProposalPerToken(proposals.data ?? []).map((proposal) => String(proposal.tokenSymbol ?? '').toUpperCase()));
  const totalSize = positions.reduce((sum, item) => sum + Number(item.size ?? 0), 0);
  const longCount = positions.filter((item) => String(item.direction ?? 'LONG').toUpperCase() !== 'SHORT').length;
  const shortCount = positions.length - longCount;
  const pricedRois = positions.map((item) => item.roi).filter((roi): roi is number => roi !== null && roi !== undefined);
  const averageRoi = pricedRois.length ? pricedRois.reduce((sum, roi) => sum + Number(roi), 0) / pricedRois.length : null;

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vị thế"
          title="Tiền của tôi đang ở đâu?"
          description="Theo dõi các vị thế đang mở, PnL/ROI và tín hiệu cần chú ý trên từng token."
        />

        {portfolio.isLoading ? (
          <DataSkeleton rows={4} />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Open positions" value={positions.length} hint="perp_positions.status = open" />
              <MetricCard label="Total size" value={formatCurrency(totalSize)} />
              <MetricCard label="Long/Short" value={`${longCount}/${shortCount}`} />
              <MetricCard label="ROI trung bình" value={averageRoi === null ? 'Chưa có dữ liệu' : formatPercent(normalizePercentValue(averageRoi))} />
            </section>

            <section className="space-y-3">
              {positions.map((position) => (
                <Link key={position._id} href={`/positions/${position._id}`} className="glass-card block rounded-xl border border-white/5 bg-black/20 p-5 hover:border-cyan-500/30">
                  <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold text-white">{position.symbol ?? position.tokenSymbol ?? 'TOKEN'}</p>
                        {getPositionBadges(position, activeProposalSymbols).map((badge) => (
                          <Badge key={badge.label} className={badge.className} variant="outline">{badge.label}</Badge>
                        ))}
                      </div>
                    </div>
                    <Mini label="Direction" value={position.direction ?? 'LONG'} />
                    <Mini label="Size" value={formatCurrency(position.size)} />
                    <Mini label="Entry price" value={formatCurrency(position.entryPrice)} />
                    <div className="text-right">
                      <p className="text-sm font-bold text-cyan-300">{position.roi === null || position.roi === undefined ? 'Chưa có dữ liệu' : formatPercent(normalizePercentValue(position.roi))}</p>
                      <p className="text-xs text-slate-500">ROI</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <Mini label="Leverage" value={`${position.leverage ?? 1}x`} />
                    <Mini label="PnL" value={position.pnl === null || position.pnl === undefined ? 'Chưa có dữ liệu' : formatCurrency(position.pnl)} />
                    <Mini label="Slippage" value={formatPercent(normalizePercentValue(position.slippagePct))} />
                  </div>
                </Link>
              ))}
              {!positions.length ? <EmptyState title="Chưa có vị thế đang mở" description="Khi execute giao dịch từ đề xuất, position sẽ xuất hiện tại đây." /> : null}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function getPositionBadges(position: { symbol?: string | null; tokenSymbol?: string | null; roi?: number | null; leverage?: number | null }, activeProposalSymbols: Set<string>) {
  const badges: Array<{ label: string; className: string }> = [];
  const roi = normalizePercentValue(position.roi);
  const symbol = String(position.symbol ?? position.tokenSymbol ?? '').toUpperCase();

  if (roi !== null && roi < 0) badges.push({ label: 'Lỗ', className: 'border-red-500/30 bg-red-500/10 text-red-300' });
  if (Number(position.leverage ?? 1) >= 5) badges.push({ label: 'Rủi ro cao', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' });
  if (symbol && activeProposalSymbols.has(symbol)) badges.push({ label: 'Có khuyến nghị mới', className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' });

  return badges;
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
