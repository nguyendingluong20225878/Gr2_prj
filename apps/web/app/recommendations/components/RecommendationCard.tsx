'use client';

import Link from 'next/link';
import { ArrowRight, Eye } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { CountdownBadge, MiniStat } from '@/app/components/shared/NdlUi';
import { formatConfidence, formatDollarAmount, formatPercent, normalizePercentValue, toDisplayAction } from '@/lib/utils/formatters';
import {
  getPortfolioImpactLabel,
  type PortfolioImpact,
  type RecommendationStatus,
} from '@/lib/utils/recommendationDerivation';

type RecommendationCardProps = {
  id: string;
  tokenSymbol?: string | null;
  action?: string | null;
  confidence?: number | null;
  riskLevel?: string | null;
  expiresAt?: string | Date | null;
  portfolioImpact: PortfolioImpact;
  status: RecommendationStatus;
  isWatched?: boolean;
  summary?: string | null;
  entryPrice?: number | null;
  currentPrice?: number | null;
  projectedPnL?: number | null;
  quantScore?: number | null;
  roi?: number | null;
  livePerformance?: {
    entryPrice: number | null;
    entryMatchedAt: string | null;
    markPrice: number | null;
    markMatchedAt: string | null;
    roiPct: number | null;
    pnlStatus: 'AVAILABLE' | 'NO_ENTRY_PRICE' | 'NO_MARK_PRICE' | 'UNSUPPORTED_ACTION';
    basis: 'MARK_TO_MARKET';
  };
  score?: number | null;
  showImpactBadge?: boolean;
  href: string;
  onWatch?: () => void;
};

function actionBadgeClass(action?: string | null) {
  const upper = String(action ?? '').toUpperCase();
  if (upper === 'BUY' || upper === 'LONG') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (upper === 'SELL' || upper === 'SHORT') return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (upper === 'HOLD' || upper === 'WAIT') return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
  return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
}

function impactBadgeClass(impact: PortfolioImpact) {
  if (impact === 'DIRECT') return 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200';
  if (impact === 'INDIRECT') return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
  if (impact === 'OUTSIDE') return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
}

export function RecommendationCard({
  action,
  confidence,
  currentPrice,
  entryPrice,
  expiresAt,
  href,
  isWatched,
  livePerformance,
  onWatch,
  portfolioImpact,
  projectedPnL,
  roi,
  showImpactBadge = true,
  status,
  tokenSymbol,
}: RecommendationCardProps) {
  const archived = status === 'EXPIRED' || status === 'VERIFIED' || status === 'EXECUTED';
  const canUseLivePerformance = !archived && Boolean(livePerformance);
  const hasLiveRoi = canUseLivePerformance && livePerformance?.pnlStatus === 'AVAILABLE';
  const displayEntryPrice = canUseLivePerformance
    ? livePerformance?.entryPrice ?? entryPrice
    : entryPrice;
  const displayCurrentPrice = canUseLivePerformance
    ? livePerformance?.markPrice ?? currentPrice
    : currentPrice;
  const displayRoi = hasLiveRoi ? livePerformance?.roiPct : normalizePercentValue(roi);
  const currentPriceLabel = status === 'VERIFIED' ? 'Giá sau 24h' : 'Giá hiện tại';

  return (
    <article className={`rounded-xl border p-4 transition-colors ${
      portfolioImpact === 'DIRECT'
        ? 'border-cyan-500/25 bg-cyan-500/[0.06] hover:border-cyan-500/40'
        : archived
          ? 'border-white/5 bg-black/25 opacity-80'
          : 'border-white/5 bg-black/40 hover:border-cyan-500/30 hover:bg-white/[0.03]'
    }`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-white">{tokenSymbol ?? 'Token chưa định danh'}</span>
            <Badge className={actionBadgeClass(action)} variant="outline">{toDisplayAction(action)}</Badge>
            {showImpactBadge ? <Badge className={impactBadgeClass(portfolioImpact)} variant="outline">{getPortfolioImpactLabel(portfolioImpact)}</Badge> : null}
            {status !== 'VERIFIED' ? <CountdownBadge value={expiresAt} /> : null}
            <Badge className="border-white/10 bg-black/30 text-slate-200" variant="outline">Tin cậy {formatConfidence(confidence)}</Badge>
            {isWatched ? <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" variant="outline">Đã theo dõi</Badge> : null}
          </div>
          {status === 'EXPIRED' ? (
            <p className="mt-2 text-xs text-slate-400">Khuyến nghị đã hết hiệu lực và chỉ còn giá trị tham khảo.</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
            <Link href={href}>Xem chi tiết <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          {onWatch && !isWatched && !archived ? (
            <Button onClick={onWatch} variant="outline" className="border-cyan-500/30 text-cyan-300">
              <Eye className="h-4 w-4" /> Theo dõi
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <MiniStat label="Giá vào tạm tính" value={formatDollarAmount(displayEntryPrice)} />
        <MiniStat label={currentPriceLabel} value={formatDollarAmount(displayCurrentPrice)} />
        <MiniStat label="PnL tạm tính" value={displayRoi === null || displayRoi === undefined ? getPnlFallbackLabel(livePerformance?.pnlStatus, projectedPnL) : formatPercent(displayRoi)} />
      </div>
    </article>
  );
}

function getPnlFallbackLabel(status: NonNullable<RecommendationCardProps['livePerformance']>['pnlStatus'] | undefined, projectedPnL?: number | null) {
  if (projectedPnL !== null && projectedPnL !== undefined) return formatDollarAmount(projectedPnL);
  if (status === 'NO_ENTRY_PRICE') return 'Chờ giá vào';
  if (status === 'NO_MARK_PRICE') return 'Chờ giá hiện tại';
  if (status === 'UNSUPPORTED_ACTION') return 'Không áp dụng';
  return 'Chưa có dữ liệu';
}
