'use client';

import Link from 'next/link';
import { useState } from 'react';
import type React from 'react';
import { AlertTriangle, ArrowRight, BarChart3, ShieldCheck, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/app/components/ui/badge';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import {
  DataSkeleton,
  EmptyState,
  getMissingPriceReasonLabel,
  MetricCard,
  PageHeader,
} from '@/app/components/shared/NdlUi';
import { useNdlData } from '@/lib/hooks/useNdlData';
import { formatConfidence, formatCurrency, formatDollarAmount, formatNumber, toDisplayAction, toDisplayRisk } from '@/lib/utils/formatters';
import { formatExpiry, formatRelativeVietnamese, formatVietnameseDateTime } from '@/lib/utils/time';
import type { Holding, Investment, ModelHealthData, PortfolioCrossImpact, ProposalData } from '@/lib/hooks/useNdlData';
import {
  deriveIsWatched,
  derivePortfolioImpact,
  deriveRecommendationStatus,
  getRecommendationStatusLabel,
  type PortfolioImpact,
  type RecommendationStatus,
} from '@/lib/utils/recommendationDerivation';

type TodayActionItem = {
  proposal: ProposalData;
  impact: PortfolioImpact;
  status: RecommendationStatus;
  isWatched: boolean;
};

type ReviewScope = 'portfolio' | 'outside';

type TokenImpactItem = PortfolioCrossImpact & {
  impactedToken: string;
};

export default function OverviewPage() {
  const [reviewScope, setReviewScope] = useState<ReviewScope>('portfolio');
  const { walletAddress, portfolio, proposals, modelHealth, crossImpacts, watchlist, lastSyncedAt } = useNdlData();
  const portfolioData = portfolio.data;
  const proposalList = proposals.data ?? [];
  const holdings = portfolioData?.holdings;
  const impacts = crossImpacts.data;
  const totalValueStatus = portfolioData?.stats?.totalValueStatus;
  const totalValue = portfolioData?.stats?.totalValue ?? null;
  const missingPriceCount = portfolioData?.stats?.missingPriceCount ?? 0;
  const totalValueHasMissingPrice = totalValueStatus === 'MISSING_PRICE_DATA' || totalValueStatus === 'PARTIAL';
  const totalValueLabel = totalValueStatus === 'MISSING_PRICE_DATA'
    ? 'Chưa đủ dữ liệu giá'
    : totalValueStatus === 'PARTIAL'
      ? `Ước tính ${formatDollarAmount(totalValue)}`
      : formatDollarAmount(totalValue);
  const totalValueHint = totalValueHasMissingPrice
    ? missingPriceCount > 0
      ? `${missingPriceCount} token thiếu giá, tổng giá trị có thể chưa đầy đủ`
      : 'Tổng giá trị có thể chưa đầy đủ do dữ liệu giá chưa hoàn chỉnh'
    : 'Từ dữ liệu danh mục đã đồng bộ';
  const activeOpenInvestments = (portfolioData?.investments ?? []).filter(isExecutedOpenInvestment);
  const holdingsForDisplay = [...(portfolioData?.holdings ?? [])].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
  const recommendationItems: TodayActionItem[] = proposalList.map((proposal) => ({
    proposal,
    impact: derivePortfolioImpact({ proposal, holdings, crossImpacts: impacts }),
    status: deriveRecommendationStatus(proposal),
    isWatched: deriveIsWatched(proposal, watchlist.data),
  }));
  const reviewItems = recommendationItems
    .filter((item) => ['ACTIVE', 'EXPIRING_SOON', 'MISSING_DATA'].includes(item.status))
    .sort(sortTodayActions);
  const portfolioReviewItems = reviewItems.filter((item) => item.impact === 'DIRECT' || item.impact === 'INDIRECT');
  const outsideReviewItems = reviewItems.filter((item) => item.impact === 'OUTSIDE');
  const selectedReviewItems = reviewScope === 'portfolio' ? portfolioReviewItems : outsideReviewItems;
  const todayQueue = selectedReviewItems.slice(0, 5);
  const expiringSoonCount = recommendationItems.filter((item) => item.status === 'EXPIRING_SOON').length;
  const staleDataAgeMs = getLatestDataAgeMs(proposalList, modelHealth.data);
  const hasStaleData = staleDataAgeMs !== null && staleDataAgeMs > 60 * 60 * 1000;
  const riskIssueCount = missingPriceCount + (hasStaleData ? 1 : 0);
  const crossPortfolioImpacts = [...(crossImpacts.data ?? [])].sort(sortCrossImpact);
  const tokenImpactItems: TokenImpactItem[] = crossPortfolioImpacts
    .flatMap((impact) => impact.impactedTokens.map((token) => ({ ...impact, impactedToken: token })))
    .sort(sortTokenImpactByNewest)
    .slice(0, 6);
  const systemBadge = getSystemBadge(modelHealth.data);
  const freshnessLabel = getFreshnessLabel(lastSyncedAt, portfolioData?.holdings ?? []);
  const dataWarnings = buildDataWarnings({
    holdings: portfolioData?.holdings ?? [],
    missingPriceCount,
    staleDataAgeMs,
  });

  const watchRecommendation = async (proposal: ProposalData) => {
    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal._id,
          addedBy: 'USER',
          reason: 'Theo dõi khuyến nghị từ Tổng quan',
          status: 'WATCHING',
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Không thể thêm vào danh sách theo dõi');
      toast.success('Đã thêm vào theo dõi.');
      await watchlist.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể thêm vào danh sách theo dõi');
    }
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <PageHeader
          eyebrow="Tổng quan"
          title="Hôm nay danh mục của tôi cần xử lý gì?"
          description="NDL ưu tiên token bạn đang nắm giữ, sau đó mới đến tín hiệu ngoài danh mục."
          actions={
            <>
              <TrustBadge label={systemBadge.label} className={systemBadge.className} />
              <span className="inline-flex items-center rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-300">
                {freshnessLabel}
              </span>
            </>
          }
        />

        {!walletAddress ? (
          <EmptyState
            title="Kết nối ví để xem khuyến nghị cá nhân hóa"
            description="Ứng dụng chỉ đọc dữ liệu ví cần thiết để cá nhân hóa danh mục. NDL không thể tự thực hiện giao dịch nếu bạn chưa xác nhận."
          />
        ) : portfolio.isLoading || proposals.isLoading ? (
          <DataSkeleton rows={4} />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Tổng giá trị danh mục" value={totalValueLabel} hint={totalValueHint} />
              <MetricCard label="Khuyến nghị cần xem xét" value={reviewItems.length} hint="Ưu tiên token trong danh mục" />
              <MetricCard label="Rủi ro cần chú ý" value={riskIssueCount} hint="Token thiếu giá hoặc dữ liệu danh mục cần kiểm tra" />
              <MetricCard label="Tín hiệu sắp hết hạn" value={expiringSoonCount} hint="Cần đọc trước khi quá hạn" />
            </section>

            {dataWarnings.length ? (
              <RiskBanner
                title="Dữ liệu cần kiểm tra trước khi hành động"
                description={dataWarnings[0]}
                issueCount={riskIssueCount}
                affectedTokens={dataWarnings.slice(1, 4)}
              />
            ) : null}

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">Xem xét ngay</h2>
                  <p className="mt-1 text-sm text-slate-500">Tối đa 5 khuyến nghị quan trọng nhất cho hôm nay.</p>
                </div>
                {selectedReviewItems.length > 5 ? (
                  <Button asChild variant="outline" size="sm" className="border-cyan-500/30 text-cyan-300">
                    <Link href="/recommendations?tab=urgent"><BarChart3 className="h-4 w-4" /> Xem tất cả khuyến nghị</Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm" className="border-cyan-500/30 text-cyan-300">
                    <Link href="/recommendations"><BarChart3 className="h-4 w-4" /> Xem khuyến nghị</Link>
                  </Button>
                )}
              </div>
              <div className="mb-4 inline-flex rounded-lg border border-white/10 bg-black/30 p-1">
                <button
                  type="button"
                  onClick={() => setReviewScope('portfolio')}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${reviewScope === 'portfolio' ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-400 hover:text-white'}`}
                >
                  Ảnh hưởng danh mục
                </button>
                <button
                  type="button"
                  onClick={() => setReviewScope('outside')}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${reviewScope === 'outside' ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-400 hover:text-white'}`}
                >
                  Ngoài danh mục
                </button>
              </div>
              <div className="space-y-3">
                {todayQueue.map((item) => (
                  <TodayActionCard
                    key={item.proposal._id}
                    item={item}
                    onWatch={() => watchRecommendation(item.proposal)}
                  />
                ))}
                {!todayQueue.length ? (
                  <EmptyState
                    title="Không có khuyến nghị cần xem xét"
                    description={reviewScope === 'portfolio' ? 'Không có khuyến nghị còn hiệu lực nào liên quan đến danh mục lúc này.' : 'Không có cơ hội ngoài danh mục nào cần ưu tiên lúc này.'}
                  />
                ) : null}
                {selectedReviewItems.length > 5 ? (
                  <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                    <Link href="/recommendations?tab=urgent">Xem tất cả khuyến nghị</Link>
                  </Button>
                ) : null}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Tài sản đang nắm giữ</h2>
                    <p className="text-sm text-slate-500">Ưu tiên xem rủi ro và khuyến nghị trên token bạn đang có.</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="border-white/10">
                    <Link href="/portfolio"><Wallet className="h-4 w-4" /> Xem danh mục</Link>
                  </Button>
                </div>
                <div className="max-h-[330px] space-y-3 overflow-y-auto pr-1">
                  {holdingsForDisplay.length ? holdingsForDisplay.map((holding, index) => (
                    <HoldingSnapshotRow
                      key={holding.tokenAddress ?? `${holding.symbol}-${index}`}
                      holding={holding}
                      recommendations={recommendationItems}
                      totalValue={totalValue}
                    />
                  )) : (
                    <EmptyState title="Chưa có tài sản trong ví" description="Đồng bộ ví để NDL đọc danh mục." />
                  )}
                </div>
              </div>

              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Vị thế trade đang mở</h2>
                    <p className="text-sm text-slate-500">Các lệnh đã thực hiện và chưa đóng.</p>
                  </div>
                  <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                    {activeOpenInvestments.length} vị thế
                  </Badge>
                </div>
                <div className="space-y-3">
                  {activeOpenInvestments.slice(0, 4).map((investment) => (
                    <MiniPosition key={investment._id} investment={investment} />
                  ))}
                  {!activeOpenInvestments.length ? (
                    <EmptyState title="Chưa có vị thế đang mở" description="Các giao dịch đã xác nhận sẽ xuất hiện tại đây." />
                  ) : null}
                  {activeOpenInvestments.length > 4 ? (
                    <Button asChild variant="outline" size="sm" className="border-cyan-500/30 text-cyan-300">
                      <Link href="/positions">Xem tất cả vị thế</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Token có thể ảnh hưởng đến danh mục</h2>
                  <p className="text-sm text-slate-500">Nguồn tin nhắc token bạn đang giữ cùng token khác. Đây là tín hiệu theo dõi, không phải hành động trực tiếp.</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-cyan-300">
                  <Link href="/recommendations?tab=outside-portfolio">Xem thêm</Link>
                </Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {tokenImpactItems.map((impact) => (
                  <TokenImpactCard key={`${impact.sourceLabel}-${impact.impactedToken}-${impact.createdAt ?? impact.reason}`} impact={impact} />
                ))}
                {!tokenImpactItems.length ? (
                  <EmptyState
                    title="Chưa có ảnh hưởng gián tiếp đáng chú ý"
                    description="Hiện chưa có tín hiệu liên quan chéo tới tài sản đang theo dõi."
                  />
                ) : null}
              </div>
            </section>

            <Disclaimer />
          </>
        )}
      </div>
    </Layout>
  );
}

function isExecutedOpenInvestment(investment: Investment) {
  const hasExecution = Boolean(investment.executionId || investment.txHash || investment.executedPrice !== null && investment.executedPrice !== undefined);
  const direction = String(investment.direction ?? '').toUpperCase();
  const isClosed = direction === 'CLOSED' || direction === 'CLOSE_POSITION';
  return hasExecution && !isClosed;
}

function sortTodayActions(a: TodayActionItem, b: TodayActionItem) {
  const scoreA = getTodayPriorityScore(a);
  const scoreB = getTodayPriorityScore(b);
  if (scoreA !== scoreB) return scoreB - scoreA;
  return new Date(b.proposal.createdAt ?? 0).getTime() - new Date(a.proposal.createdAt ?? 0).getTime();
}

function getTodayPriorityScore(item: TodayActionItem) {
  const action = String(item.proposal.action ?? item.proposal.suggestionType ?? '').toUpperCase();
  const risk = String(item.proposal.financialImpact?.riskLevel ?? '').toUpperCase();
  let score = Number(item.proposal.confidence ?? 0);
  if (item.status === 'EXPIRING_SOON') score += 120;
  if (item.impact === 'DIRECT') score += 90;
  if (item.impact === 'INDIRECT') score += 35;
  if (action === 'SELL' || risk === 'HIGH' || risk === 'CRITICAL') score += 45;
  if (item.status === 'MISSING_DATA') score += 20;
  return score;
}

function sortCrossImpact(a: PortfolioCrossImpact, b: PortfolioCrossImpact) {
  const scoreA = Number(a.weight ?? 0) + Number(a.confidence ?? 0);
  const scoreB = Number(b.weight ?? 0) + Number(b.confidence ?? 0);
  if (scoreA !== scoreB) return scoreB - scoreA;
  return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
}

function sortTokenImpactByNewest(a: TokenImpactItem, b: TokenImpactItem) {
  const timeA = new Date(a.createdAt ?? 0).getTime();
  const timeB = new Date(b.createdAt ?? 0).getTime();
  if (timeA !== timeB) return timeB - timeA;
  return a.impactedToken.localeCompare(b.impactedToken);
}

function getSystemBadge(data?: ModelHealthData) {
  const active = String(data?.activeConfig?.status ?? '').toUpperCase() === 'ACTIVE';
  const checkStatus = String(data?.latestBacktestRun?.status ?? '').toUpperCase();
  const hasMetrics = Boolean(Object.keys(data?.activeConfig?.metrics ?? data?.latestBacktestRun?.metrics ?? {}).length);

  if (!data) {
    return {
      label: 'Đang cập nhật',
      className: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
    };
  }

  if (!active || checkStatus.includes('FAIL') || checkStatus.includes('ERROR') || !hasMetrics) {
    return {
      label: 'Dữ liệu hạn chế',
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    };
  }

  return {
    label: 'Hệ thống ổn định',
    className: 'border-green-500/30 bg-green-500/10 text-green-200',
  };
}

function getFreshnessLabel(lastSyncedAt: number | null, holdings: Holding[]) {
  if (lastSyncedAt) return `Cập nhật: ${formatVietnameseDateTime(new Date(lastSyncedAt))}`;
  if (holdings.length) return 'Cập nhật: danh mục đã tải';
  return 'Cập nhật: chưa có dữ liệu';
}

function getLatestDataTime(proposals: ProposalData[], modelHealth?: ModelHealthData) {
  return [
    ...proposals.map((proposal) => proposal.createdAt),
    modelHealth?.activeConfig?.updatedAt,
    modelHealth?.latestBacktestRun?.endedAt,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];
}

function getLatestDataAgeMs(proposals: ProposalData[], modelHealth?: ModelHealthData) {
  const latest = getLatestDataTime(proposals, modelHealth);
  return latest ? Date.now() - latest : null;
}

function buildDataWarnings({
  holdings,
  missingPriceCount,
  staleDataAgeMs,
}: {
  holdings: Holding[];
  missingPriceCount: number;
  staleDataAgeMs: number | null;
}) {
  const warnings: string[] = [];
  if (staleDataAgeMs !== null && staleDataAgeMs > 60 * 60 * 1000) {
    const hours = Math.max(1, Math.round(staleDataAgeMs / (60 * 60 * 1000)));
    warnings.push(`Dữ liệu đã hơn ${hours} giờ chưa có cập nhật mới. Hãy kiểm tra lại trước khi hành động.`);
  }

  if (missingPriceCount > 0) {
    warnings.push(`${missingPriceCount} token thiếu giá nên tổng giá trị danh mục có thể chưa đầy đủ.`);
  }

  holdings
    .filter((holding) => holding.dataQuality === 'MISSING_PRICE')
    .slice(0, 3)
    .forEach((holding, index) => warnings.push(`${holding.symbol || `Token ${index + 1}`}: ${getMissingPriceReasonLabel(holding.missingReason)}`));

  return warnings;
}

// Tạm ẩn lý do ngắn trong card "Xem xét ngay" cho tới khi thống nhất đúng field hiển thị.
// function getShortReason(proposal: ProposalData) {
//   if (proposal.rationaleSummary) return proposal.rationaleSummary;
//   if (proposal.summary) return proposal.summary;
//   if (proposal.reason?.length) return proposal.reason.slice(0, 2).join(' ');
//   if (proposal.title) return proposal.title;
//   return 'Chưa có lý do ngắn cho khuyến nghị này.';
// }

function TrustBadge({ label, className }: { label: string; className: string }) {
  return (
    <Link href="/model-health" className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${className}`}>
      <ShieldCheck className="h-4 w-4" />
      {label}
    </Link>
  );
}

function RiskBanner({
  title,
  description,
  issueCount,
  affectedTokens,
}: {
  title: string;
  description: string;
  issueCount: number;
  affectedTokens: string[];
}) {
  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <h2 className="font-bold">{title}</h2>
            <p className="mt-1 text-sm text-amber-100/80">{description}</p>
            {affectedTokens.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {affectedTokens.map((token) => (
                  <span key={token} className="rounded border border-amber-500/20 bg-black/20 px-2 py-1 text-xs">
                    {token}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <Badge variant="outline" className="w-fit border-amber-500/30 bg-black/20 text-amber-200">
          {issueCount} điểm cần chú ý
        </Badge>
      </div>
    </section>
  );
}

function TodayActionCard({ item, onWatch }: { item: TodayActionItem; onWatch?: () => void }) {
  const { proposal, impact, status, isWatched } = item;
  const action = proposal.action ?? proposal.suggestionType;
  const risk = proposal.financialImpact?.riskLevel;
  // const shortReason = getShortReason(proposal);
  const sourceCount = (proposal.sources?.length ?? 0) + (proposal.signalContext?.sources?.length ?? 0);
  const canWatch = !isWatched && status !== 'EXPIRED' && status !== 'VERIFIED' && status !== 'EXECUTED';

  return (
    <article className={`rounded-xl border bg-black/40 p-4 transition-colors ${impact === 'DIRECT' ? 'border-cyan-500/25' : 'border-white/5'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-white">{proposal.tokenSymbol ?? proposal.tokenName ?? 'Token chưa định danh'}</span>
            <Badge className={actionBadgeClass(action)} variant="outline">{toDisplayAction(action)}</Badge>
            <RiskBadge risk={risk} />
            {status !== 'MISSING_DATA' ? <StatusBadge status={status} /> : null}
            {isWatched ? <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Đã theo dõi</Badge> : null}
          </div>
          {/* Tạm ẩn lý do ngắn trong card "Xem xét ngay". */}
          {/* <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">{shortReason}</p> */}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
            <Link href={`/proposal/${proposal._id}`}>Xem chi tiết <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          {canWatch && onWatch ? (
            <Button type="button" variant="outline" className="border-cyan-500/30 text-cyan-300" onClick={onWatch}>
              Theo dõi
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <MiniImpact label="Tin cậy" value={formatConfidence(proposal.confidence)} />
        <MiniImpact label="Thời hạn" value={formatExpiry(proposal.expiresAt)} />
        <MiniImpact label="Nguồn" value={sourceCount} />
      </div>
    </article>
  );
}

function RiskBadge({ risk }: { risk?: string | null }) {
  const value = String(risk ?? '').toUpperCase();
  const className = value === 'CRITICAL'
    ? 'border-red-500/40 bg-red-500/15 text-red-200'
    : value === 'HIGH'
      ? 'border-orange-500/30 bg-orange-500/10 text-orange-200'
      : value === 'MEDIUM'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : 'border-green-500/30 bg-green-500/10 text-green-200';

  return <Badge className={className} variant="outline">{toDisplayRisk(risk)}</Badge>;
}

function StatusBadge({ status }: { status: RecommendationStatus }) {
  const className = status === 'EXPIRING_SOON' || status === 'MISSING_DATA'
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    : status === 'EXPIRED'
      ? 'border-slate-500/30 bg-slate-500/10 text-slate-300'
      : 'border-green-500/30 bg-green-500/10 text-green-300';

  return <Badge className={className} variant="outline">{getRecommendationStatusLabel(status)}</Badge>;
}

function TokenImpactCard({ impact }: { impact: TokenImpactItem }) {
  const sourceTime = impact.createdAt ? formatRelativeVietnamese(impact.createdAt) : 'Chưa có thời điểm nguồn';

  return (
    <div className="rounded-xl border border-white/5 bg-black/40 p-4 text-sm text-slate-300 transition-colors hover:border-purple-500/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 font-semibold text-white">{impact.impactedToken}</p>
          <p className="mt-1 text-xs text-slate-500">Nguồn cập nhật {sourceTime}</p>
        </div>
        <span className="shrink-0 rounded border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-xs font-bold text-purple-200">
          Ảnh hưởng gián tiếp
        </span>
      </div>

      <div className="mt-4 grid gap-2 rounded-lg border border-white/5 bg-black/30 p-3">
        <MiniImpact label="Liên quan tới tài sản" value={impact.holdingTokens.join(', ')} />
        <MiniImpact label="Nguồn" value={impact.sourceLabel} />
        <MiniImpact label="Thời điểm" value={sourceTime} />
      </div>

      <p className="mt-3 leading-6">{impact.reason}</p>
      {impact.sourceUrl ? (
        <Link href={impact.sourceUrl} target="_blank" className="mt-3 inline-flex text-xs font-semibold text-cyan-300 hover:text-cyan-200">
          Mở nguồn dữ liệu
        </Link>
      ) : null}
    </div>
  );
}

function MiniPosition({ investment }: { investment: Investment }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-white">{investment.tokenSymbol ?? investment.symbol ?? 'Token chưa định danh'}</p>
        <Badge variant="outline" className="border-white/10 bg-black/40 text-slate-300">
          {investment.direction ?? 'Đang mở'}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MiniImpact label="Giá vào" value={formatCurrency(investment.executedPrice ?? investment.entryPrice)} />
        <MiniImpact label="PnL" value={investment.pnl === null || investment.pnl === undefined ? 'Chưa có dữ liệu' : formatCurrency(investment.pnl)} />
      </div>
    </div>
  );
}

function HoldingSnapshotRow({
  holding,
  recommendations,
  totalValue,
}: {
  holding: Holding;
  recommendations: TodayActionItem[];
  totalValue: number | null;
}) {
  const missingPrice = holding.dataQuality === 'MISSING_PRICE' || holding.price === null || holding.price === undefined || holding.value === null || holding.value === undefined;
  const relatedCount = getHoldingRelatedRecommendationCount(holding, recommendations);
  const allocation = totalValue && holding.value ? `${formatNumber((Number(holding.value) / totalValue) * 100, 1)}%` : null;

  return (
    <div className="rounded-xl border border-white/5 bg-black/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-white">{holding.symbol || holding.tokenAddress || 'Token chưa định danh'}</p>
          {holding.tokenAddress ? <p className="mt-1 truncate text-xs text-slate-500">{holding.tokenAddress}</p> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {allocation ? (
            <Badge variant="outline" className="border-white/10 bg-black/30 text-slate-300">
              {allocation} danh mục
            </Badge>
          ) : null}
          {missingPrice ? (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200">
              {getHoldingPriceBadgeLabel(holding)}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-200">
              {getHoldingPriceBadgeLabel(holding)}
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <MiniImpact label="Số dư" value={formatNumber(holding.balance)} />
        <MiniImpact label="Giá trị" value={missingPrice ? 'Có thể chưa đầy đủ' : formatCurrency(holding.value)} />
        <MiniImpact label="Còn cần xem xét" value={relatedCount} />
      </div>
    </div>
  );
}

function MiniImpact({ label, value }: { label: string; value: React.ReactNode }) {
  const displayValue = value === null || value === undefined || value === '' ? 'Chưa có dữ liệu' : value;

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-100">{displayValue}</p>
    </div>
  );
}

function Disclaimer() {
  return (
    <section className="rounded-xl border border-white/5 bg-black/30 p-4 text-sm text-slate-400">
      NDL không phải cố vấn tài chính. Khuyến nghị chỉ là dữ liệu hỗ trợ quyết định. Bạn chịu trách nhiệm với mọi giao dịch.
    </section>
  );
}

function actionBadgeClass(action?: string | null) {
  const value = String(action ?? '').toUpperCase();
  if (value === 'BUY' || value === 'LONG') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (value === 'SELL' || value === 'SHORT') return 'border-red-500/30 bg-red-500/10 text-red-300';
  return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
}

function getHoldingRelatedRecommendationCount(holding: Holding, recommendations: TodayActionItem[]) {
  const symbol = normalizeSymbol(holding.symbol);
  if (!symbol) return 0;

  return recommendations.filter((item) => {
    const proposalSymbol = normalizeSymbol(item.proposal.tokenSymbol ?? item.proposal.tokenName);
    return proposalSymbol === symbol
      && item.impact !== 'OUTSIDE'
      && ['ACTIVE', 'EXPIRING_SOON', 'MISSING_DATA'].includes(item.status);
  }).length;
}

function getHoldingPriceBadgeLabel(holding: Holding) {
  if (holding.dataQuality !== 'MISSING_PRICE' && holding.price !== null && holding.price !== undefined) {
    return 'Đã có giá thị trường';
  }
  if (holding.missingReason === 'NO_TOKEN_MAPPING') return 'Chưa nhận diện được token';
  if (holding.missingReason === 'NO_PRICE') return 'Chưa có giá thị trường';
  return 'Thiếu giá';
}

function normalizeSymbol(value?: string | null) {
  return String(value ?? '').trim().toUpperCase();
}
