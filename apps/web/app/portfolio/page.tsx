'use client';

import Link from 'next/link';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/app/components/layout/Layout';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { DataQualityBadge, DataSkeleton, EmptyState, getMissingPriceReasonLabel, MetricCard, PageHeader } from '@/app/components/shared/NdlUi';
import { useAuth } from '@/app/contexts/AuthContext';
import { useNdlData, type Holding, type ProposalData } from '@/lib/hooks/useNdlData';
import { formatConfidence, formatCurrency, formatDollarAmount, formatNumber, toDisplayAction, toDisplayRisk } from '@/lib/utils/formatters';
import { formatExpiry } from '@/lib/utils/time';
import {
  derivePortfolioImpact,
  deriveRecommendationStatus,
  getPortfolioImpactLabel,
  normalizeTokenSymbol,
  type PortfolioImpact,
} from '@/lib/utils/recommendationDerivation';

type HoldingInsight = {
  holding: Holding;
  directRecommendations: PortfolioRecommendationItem[];
  indirectRecommendations: PortfolioRecommendationItem[];
  riskStatus: 'Cần kiểm tra' | 'Có rủi ro' | 'Có khuyến nghị' | 'Ổn';
};

type PortfolioRecommendationItem = {
  proposal: ProposalData;
  impact: PortfolioImpact;
  status: ReturnType<typeof deriveRecommendationStatus>;
};

export default function PortfolioPage() {
  const { setUser } = useAuth();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { portfolio, proposals, crossImpacts } = useNdlData();

  const data = portfolio.data;
  const holdings = data?.holdings ?? [];
  const proposalList = proposals.data ?? [];
  const totalValue = data?.stats?.totalValue ?? null;
  const missingPriceCount = data?.stats?.missingPriceCount ?? 0;
  const totalValueStatus = data?.stats?.totalValueStatus;
  const totalValueHasMissingPrice = totalValueStatus === 'MISSING_PRICE_DATA' || totalValueStatus === 'PARTIAL' || missingPriceCount > 0;
  const totalValueLabel = totalValueStatus === 'MISSING_PRICE_DATA'
    ? 'Chưa đủ dữ liệu giá'
    : totalValueStatus === 'PARTIAL' || missingPriceCount > 0
      ? `Ước tính ${formatDollarAmount(totalValue)}`
      : formatDollarAmount(totalValue);
  const totalValueHint = totalValueHasMissingPrice
    ? missingPriceCount > 0
      ? `Chưa tính đủ ${missingPriceCount} token thiếu giá`
      : 'Tổng giá trị có thể chưa đầy đủ do dữ liệu giá chưa hoàn chỉnh'
    : 'Đã có giá cho toàn bộ tài sản';
  const recommendationItems: PortfolioRecommendationItem[] = proposalList
    .map((proposal) => ({
      proposal,
      impact: derivePortfolioImpact({ proposal, holdings, crossImpacts: crossImpacts.data }),
      status: deriveRecommendationStatus(proposal),
    }));
  const reviewItems = recommendationItems
    .filter((item) => ['ACTIVE', 'EXPIRING_SOON', 'MISSING_DATA'].includes(item.status))
    .sort(sortReviewItems);
  const holdingInsights = buildHoldingInsights(holdings, reviewItems);
  const relatedRecommendations = reviewItems.filter((item) => item.impact === 'DIRECT' || item.impact === 'INDIRECT');
  const directRecommendations = relatedRecommendations.filter((item) => item.impact === 'DIRECT');
  const indirectRecommendations = relatedRecommendations.filter((item) => item.impact === 'INDIRECT');
  const directRecommendationsForDisplay = directRecommendations.slice(0, 6);
  const indirectRecommendationsForDisplay = indirectRecommendations.slice(0, 6);
  const highRiskHoldingCount = holdingInsights.filter((item) => item.riskStatus === 'Có rủi ro' || item.riskStatus === 'Cần kiểm tra').length;

  const handleSyncBalances = async () => {
    if (!publicKey) {
      toast.error('Vui lòng kết nối ví trước.');
      return;
    }

    try {
      const balances: Array<{ tokenAddress: string; balance: string; updatedAt: Date }> = [];
      const solBalance = await connection.getBalance(publicKey);
      balances.push({
        tokenAddress: 'So11111111111111111111111111111111111111112',
        balance: (solBalance / LAMPORTS_PER_SOL).toString(),
        updatedAt: new Date(),
      });

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      tokenAccounts.value.forEach((account) => {
        const info = account.account.data.parsed.info;
        const amount = info.tokenAmount.uiAmountString;
        if (Number(amount) > 0) {
          balances.push({ tokenAddress: info.mint, balance: amount, updatedAt: new Date() });
        }
      });

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balances }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không đồng bộ được ví');
      if (result.user) setUser(result.user);
      await portfolio.mutate();
      await proposals.mutate();
      toast.success(`Đã đồng bộ ${balances.length} tài sản.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không đồng bộ được ví');
    }
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <PageHeader
          eyebrow="Danh mục"
          title="Token nào trong ví cần chú ý?"
          description="NDL bắt đầu từ tài sản bạn đang giữ, sau đó gắn khuyến nghị, rủi ro và chất lượng dữ liệu cho từng token."
          actions={
            <>
              <Button onClick={handleSyncBalances} variant="outline" className="border-cyan-500/30 text-cyan-300">
                <RefreshCw className="h-4 w-4" /> Cập nhật ví và giá
              </Button>
              <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                <Link href="/recommendations?tab=portfolio">Xem khuyến nghị cần xem xét</Link>
              </Button>
            </>
          }
        />

        {portfolio.isLoading || proposals.isLoading || crossImpacts.isLoading ? (
          <DataSkeleton rows={4} />
        ) : portfolio.error ? (
          <EmptyState title="Không tải được danh mục" description={portfolio.error.message} />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Tổng giá trị danh mục" value={totalValueLabel} hint={totalValueHint} />
              <MetricCard label="Tài sản đang nắm giữ" value={holdings.length} />
              <MetricCard label="Token cần chú ý" value={highRiskHoldingCount} hint="Thiếu giá hoặc có rủi ro cao" />
              <MetricCard label="Còn cần xem xét" value={relatedRecommendations.length} hint="Ảnh hưởng trực tiếp và gián tiếp" />
            </section>

            {missingPriceCount > 0 ? (
              <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                  <div>
                    <h2 className="text-lg font-bold">Có token thiếu dữ liệu giá</h2>
                    <p className="mt-1 text-sm text-amber-100/80">
                      Tổng giá trị danh mục chỉ là ước tính vì một số token chưa có giá hoặc chưa được nhận diện. Đừng dùng tổng giá trị này như số chắc chắn.
                    </p>
                    <div className="mt-4 grid gap-2 lg:grid-cols-2">
                      {holdings
                        .filter(isHoldingMissingPrice)
                        .map((holding, index) => (
                          <div key={holding.tokenAddress ?? `${holding.symbol}-${index}`} className="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2 text-sm">
                            <span className="font-semibold">{holding.symbol}</span>: {getMissingPriceReasonLabel(holding.missingReason)}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-white">Danh sách tài sản</h2>
                <p className="mt-1 text-sm text-slate-500">Mỗi dòng cho biết token, số dư, giá trị, dữ liệu giá, số khuyến nghị còn cần xem xét và trạng thái rủi ro.</p>
              </div>
              <div className="space-y-3">
                {holdingInsights.map((item) => (
                  <HoldingDecisionRow key={item.holding.tokenAddress ?? item.holding.symbol} item={item} totalValue={totalValue} />
                ))}
                {!holdingInsights.length ? <EmptyState title="Chưa có tài sản trong ví" description="Hãy đồng bộ ví để NDL cá nhân hóa danh mục." /> : null}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <RecommendationSection
                title="Ảnh hưởng trực tiếp"
                description="Khuyến nghị ảnh hưởng trực tiếp tới token bạn đang nắm giữ."
                impact="DIRECT"
                items={directRecommendationsForDisplay}
                empty="Chưa có khuyến nghị trực tiếp cho danh mục."
              />
              <RecommendationSection
                title="Ảnh hưởng gián tiếp"
                description="Tín hiệu liên quan gián tiếp qua nguồn tin nhắc tới tài sản trong ví."
                impact="INDIRECT"
                items={indirectRecommendationsForDisplay}
                empty="Chưa có ảnh hưởng gián tiếp đáng chú ý."
              />
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function buildHoldingInsights(holdings: Holding[], recommendations: PortfolioRecommendationItem[]): HoldingInsight[] {
  return holdings
    .map((holding) => {
      const symbol = normalizeTokenSymbol(holding.symbol);
      const directRecommendations = recommendations.filter((item) =>
        item.impact === 'DIRECT' && normalizeTokenSymbol(item.proposal.tokenSymbol ?? item.proposal.tokenName) === symbol
      );
      const indirectRecommendations = recommendations.filter((item) =>
        item.impact === 'INDIRECT' && normalizeTokenSymbol(item.proposal.tokenSymbol ?? item.proposal.tokenName) === symbol
      );
      const hasHighRisk = [...directRecommendations, ...indirectRecommendations].some((item) => {
        const risk = String(item.proposal.financialImpact?.riskLevel ?? '').toUpperCase();
        return risk === 'HIGH' || risk === 'CRITICAL';
      });
      const riskStatus: HoldingInsight['riskStatus'] = isHoldingMissingPrice(holding)
        ? 'Cần kiểm tra'
        : hasHighRisk
          ? 'Có rủi ro'
          : directRecommendations.length || indirectRecommendations.length
            ? 'Có khuyến nghị'
            : 'Ổn';

      return { holding, directRecommendations, indirectRecommendations, riskStatus };
    })
    .sort((a, b) => Number(b.holding.value ?? 0) - Number(a.holding.value ?? 0));
}

function sortReviewItems(a: PortfolioRecommendationItem, b: PortfolioRecommendationItem) {
  const scoreA = getReviewPriorityScore(a);
  const scoreB = getReviewPriorityScore(b);
  if (scoreA !== scoreB) return scoreB - scoreA;
  return new Date(b.proposal.createdAt ?? 0).getTime() - new Date(a.proposal.createdAt ?? 0).getTime();
}

function getReviewPriorityScore(item: PortfolioRecommendationItem) {
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

function isHoldingMissingPrice(holding: Holding) {
  return holding.dataQuality === 'MISSING_PRICE' || holding.price === null || holding.price === undefined || holding.value === null || holding.value === undefined;
}

function HoldingDecisionRow({ item, totalValue }: { item: HoldingInsight; totalValue?: number | null }) {
  const { holding } = item;
  const relatedCount = item.directRecommendations.length + item.indirectRecommendations.length;
  const firstRecommendation = item.directRecommendations[0]?.proposal ?? item.indirectRecommendations[0]?.proposal;
  const allocation = totalValue && holding.value ? (holding.value / totalValue) * 100 : null;
  const missingPrice = isHoldingMissingPrice(holding);
  const valueLabel = missingPrice ? 'Chưa đủ dữ liệu giá' : formatCurrency(holding.value);
  const riskClass = item.riskStatus === 'Cần kiểm tra'
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    : item.riskStatus === 'Có rủi ro'
      ? 'border-red-500/30 bg-red-500/10 text-red-300'
      : item.riskStatus === 'Có khuyến nghị'
        ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
        : 'border-green-500/30 bg-green-500/10 text-green-300';

  return (
    <div className="grid gap-3 rounded-xl border border-white/5 bg-black/40 p-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.8fr_auto] lg:items-center">
      <div className="min-w-0">
        <p className="font-bold text-white">{holding.symbol || 'Token chưa định danh'}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{missingPrice ? getMissingPriceReasonLabel(holding.missingReason) : holding.tokenAddress}</p>
        {missingPrice && holding.tokenAddress ? <p className="mt-1 truncate text-xs text-slate-600">{holding.tokenAddress}</p> : null}
      </div>
      <Mini label="Số dư" value={formatNumber(holding.balance)} />
      <Mini label="Giá trị" value={valueLabel} />
      <div className="flex flex-wrap gap-2">
        <DataQualityBadge value={missingPrice ? 'MISSING_PRICE' : holding.dataQuality} />
        <Badge variant="outline" className="border-white/10 bg-black/40 text-slate-300">
          {allocation === null ? 'Chưa rõ tỷ trọng' : `${allocation.toFixed(1)}%`}
        </Badge>
      </div>
      <Mini label="Còn cần xem xét" value={relatedCount} />
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Badge variant="outline" className={riskClass}>{item.riskStatus}</Badge>
        {firstRecommendation ? (
          <Button asChild size="sm" variant="outline" className="border-cyan-500/30 text-cyan-300">
            <Link href={`/proposal/${firstRecommendation._id}`}>Mở <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function RecommendationSection({
  description,
  empty,
  impact,
  items,
  title,
}: {
  description: string;
  empty: string;
  impact: PortfolioImpact;
  items: PortfolioRecommendationItem[];
  title: string;
}) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        <Badge variant="outline" className="mt-3 border-white/10 bg-black/30 text-slate-300">{getPortfolioImpactLabel(impact)}</Badge>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <RelatedRecommendationCard key={item.proposal._id} proposal={item.proposal} />
        ))}
        {!items.length ? <EmptyState title={empty} /> : null}
      </div>
    </section>
  );
}

function RelatedRecommendationCard({ proposal }: { proposal: ProposalData }) {
  const action = proposal.action ?? proposal.suggestionType;
  const risk = proposal.financialImpact?.riskLevel;
  const description = proposal.summary ?? proposal.rationaleSummary ?? proposal.title ?? 'Chưa có lý do ngắn cho khuyến nghị này.';

  return (
    <article className="rounded-xl border border-white/5 bg-black/40 p-4 transition-colors hover:border-cyan-500/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-white">{proposal.tokenSymbol ?? proposal.tokenName ?? 'Token chưa định danh'}</span>
            <Badge variant="outline" className={actionBadgeClass(action)}>{toDisplayAction(action)}</Badge>
            <RiskBadge risk={risk} />
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{description}</p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0 border-cyan-500/30 text-cyan-300">
          <Link href={`/proposal/${proposal._id}`}>Mở <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Mini label="Tin cậy" value={formatConfidence(proposal.confidence)} />
        <Mini label="Thời hạn" value={formatExpiry(proposal.expiresAt)} />
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

  return <Badge variant="outline" className={className}>{toDisplayRisk(risk)}</Badge>;
}

function actionBadgeClass(action?: string | null) {
  const value = String(action ?? '').toUpperCase();
  if (value === 'BUY' || value === 'LONG') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (value === 'SELL' || value === 'SHORT') return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (value === 'HOLD' || value === 'WAIT') return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
  return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-100">{value ?? 'Chưa có dữ liệu'}</p>
    </div>
  );
}
