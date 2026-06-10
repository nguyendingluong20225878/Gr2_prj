'use client';

import Link from 'next/link';
import type React from 'react';
import { Eye, NotebookPen, PlayCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/app/components/layout/Layout';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
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
          title="Vị thế mô phỏng đang mở"
          description="Theo dõi giao dịch mô phỏng từ khuyến nghị: thử phản ứng với tín hiệu, so sánh nếu làm theo và học từ PnL giả định. Đây không phải giao dịch thật."
          actions={
            <Button type="button" onClick={() => showSimulationToast('Thêm vị thế mô phỏng')} className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
              <Plus className="h-4 w-4" /> Thêm mô phỏng
            </Button>
          }
        />

        {portfolio.isLoading ? (
          <DataSkeleton rows={4} />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Vị thế trade đang mở" value={positions.length} hint="Lệnh đã xác nhận từ khuyến nghị" />
              <MetricCard label="Tổng quy mô vị thế" value={formatCurrency(totalSize)} hint="Tổng giá trị từ vị thế mở" />
              <MetricCard label="Long/Short" value={`${longCount}/${shortCount}`} />
              <MetricCard label="ROI trung bình" value={averageRoi === null ? 'Chưa có dữ liệu' : formatPercent(normalizePercentValue(averageRoi))} />
            </section>

            <section className="space-y-3">
              {positions.map((position) => (
                <article key={position._id} className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                  <Link href={`/positions/${position._id}`} className="block hover:opacity-90">
                    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-bold text-white">{position.symbol ?? position.tokenSymbol ?? 'Token chưa định danh'}</p>
                          <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-300" variant="outline">Mô phỏng</Badge>
                          {getPositionBadges(position, activeProposalSymbols).map((badge) => (
                            <Badge key={badge.label} className={badge.className} variant="outline">{badge.label}</Badge>
                          ))}
                        </div>
                      </div>
                      <Mini label="Direction" value={position.direction ?? 'LONG'} />
                      <Mini label="Size" value={formatCurrency(position.size)} />
                      <Mini label="Entry price" value={position.entryPrice === null || position.entryPrice === undefined ? 'Chưa có giá entry' : formatCurrency(position.entryPrice)} />
                      <div className="text-right">
                        <p className="text-sm font-bold text-cyan-300">{position.roi === null || position.roi === undefined ? 'Chưa có dữ liệu' : formatPercent(normalizePercentValue(position.roi))}</p>
                        <p className="text-xs text-slate-500">ROI</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <Mini label="Leverage" value={`${position.leverage ?? 1}x`} />
                      <Mini label="PnL" value={position.pnl === null || position.pnl === undefined ? 'Chưa tính PnL realtime' : formatCurrency(position.pnl)} />
                      <Mini label="Slippage" value={position.slippagePct === null || position.slippagePct === undefined ? 'Chưa có dữ liệu khớp lệnh' : formatPercent(normalizePercentValue(position.slippagePct))} />
                    </div>
                  </Link>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
                    <Button asChild size="sm" variant="outline" className="border-cyan-500/30 text-cyan-300">
                      <Link href={`/positions/${position._id}`}><Eye className="h-4 w-4" /> Chi tiết</Link>
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => showSimulationToast('Mô phỏng đóng vị thế')} className="border-purple-500/30 text-purple-300">
                      <PlayCircle className="h-4 w-4" /> Mô phỏng đóng
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => showSimulationToast('Ghi chú vị thế')} className="border-white/10 text-slate-300">
                      <NotebookPen className="h-4 w-4" /> Ghi chú
                    </Button>
                  </div>
                </article>
              ))}
              {!positions.length ? <EmptyState title="Chưa có vị thế mô phỏng đang mở" description="Khi mô phỏng giao dịch từ khuyến nghị, vị thế sẽ xuất hiện tại đây để theo dõi giả định nếu làm theo." /> : null}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function showSimulationToast(action: string) {
  toast.info(`${action} là thao tác paper trading. Chưa có lệnh thật hoặc kết nối broker trong phiên bản này.`);
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
