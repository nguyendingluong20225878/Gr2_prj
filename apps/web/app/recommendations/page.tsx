'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { toast } from 'sonner';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useNdlData, type ProposalData } from '@/lib/hooks/useNdlData';
import { RecommendationCard } from './components/RecommendationCard';
import {
  deriveIsWatched,
  derivePortfolioImpact,
  deriveRecommendationStatus,
  type PortfolioImpact,
  type RecommendationStatus,
} from '@/lib/utils/recommendationDerivation';

type RecommendationTab = 'urgent' | 'portfolio' | 'outside-portfolio' | 'verified';
type ExpiryFilter = 'active' | 'expiring' | 'expired' | 'all';
type DataFilter = 'complete' | 'missing' | 'all';

type RecommendationItem = {
  proposal: ProposalData;
  impact: PortfolioImpact;
  status: RecommendationStatus;
  isWatched: boolean;
  priorityScore: number;
};

type RecommendationFilters = {
  action: string;
  confidence: number | null;
  data: DataFilter;
  expiry: ExpiryFilter;
  risk: string;
  token: string;
};

const tabs: Array<{ id: RecommendationTab; label: string; description: string }> = [
  { id: 'urgent', label: 'Tất cả', description: 'Tất cả proposal còn hiệu lực, không phân biệt có ảnh hưởng danh mục hay không.' },
  { id: 'portfolio', label: 'Liên quan danh mục', description: 'Khuyến nghị ảnh hưởng trực tiếp hoặc gián tiếp tới token bạn đang giữ.' },
  { id: 'outside-portfolio', label: 'Ngoài danh mục', description: 'Cơ hội nằm ngoài ví hiện tại, chỉ nên xem sau danh mục.' },
  { id: 'verified', label: 'Đã kiểm chứng', description: 'Đã có kết quả quá khứ, dùng để tham khảo độ tin cậy.' },
];

const ACTION_OPTIONS = ['BUY', 'SELL', 'HOLD', 'WAIT'] as const;
const RISK_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const CONFIDENCE_OPTIONS = [50, 60, 75] as const;

export default function RecommendationsPage() {
  return (
    <Suspense fallback={<RecommendationsFallback />}>
      <RecommendationsContent />
    </Suspense>
  );
}

function RecommendationsFallback() {
  return (
    <Layout>
      <DataSkeleton rows={4} />
    </Layout>
  );
}

function RecommendationsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = normalizeTab(searchParams.get('tab'));
  const filters = getFilters(searchParams);
  const { portfolio, proposals, crossImpacts, watchlist } = useNdlData();
  const items = useMemo(() => (proposals.data ?? [])
    .map((proposal) => {
      const impact = derivePortfolioImpact({
        proposal,
        holdings: portfolio.data?.holdings,
        crossImpacts: crossImpacts.data,
      });
      const status = deriveRecommendationStatus(proposal);
      return {
        proposal,
        impact,
        status,
        isWatched: deriveIsWatched(proposal, watchlist.data),
        priorityScore: computePriorityScore(proposal, impact, status),
      };
    }), [portfolio.data?.holdings, proposals.data, crossImpacts.data, watchlist.data]);

  const tokenOptions = useMemo(() => getTokenOptions(proposals.data ?? []), [proposals.data]);
  const tabItems = getItemsForTab(items, activeTab);
  const visibleItems = applyFilters(tabItems, filters)
    .sort((a, b) => b.priorityScore - a.priorityScore || new Date(b.proposal.createdAt ?? 0).getTime() - new Date(a.proposal.createdAt ?? 0).getTime());
  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const hasActiveFilters = hasFilters(filters);
  const listClassName = activeTab === 'outside-portfolio' ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4';
  const hrefFor = (updates: Record<string, string | null>) => buildHref(pathname, searchParams, updates);
  const updateFilter = (key: keyof RecommendationFilters, value: string) => {
    router.push(hrefFor({ [key]: value === 'all' ? null : value, tab: activeTab }));
  };

  const watchRecommendation = async (proposal: ProposalData) => {
    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal._id,
          addedBy: 'USER',
          reason: 'Theo dõi khuyến nghị từ Recommendation Center',
          status: 'WATCHING',
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Không thêm được vào danh sách theo dõi');
      toast.success('Đã thêm vào theo dõi.');
      await watchlist.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thêm được vào theo dõi');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Trung tâm khuyến nghị"
          title="Chọn việc cần quyết định tiếp theo"
          description="Ưu tiên danh mục trước, sau đó mới đến cơ hội ngoài ví. Danh sách chỉ hiển thị các khuyến nghị còn phù hợp để xem xét."
          actions={
            <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
              <Link href="/portfolio">Xem danh mục</Link>
            </Button>
          }
        />

        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Bộ lọc khuyến nghị">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <Link
                key={tab.id}
                href={hrefFor({ tab: tab.id })}
                aria-current={active ? 'page' : undefined}
                className={`min-w-fit rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                    : 'border-white/10 bg-black/20 text-slate-400 hover:border-cyan-500/25 hover:text-slate-100'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <FilterBar
          filters={filters}
          hasActiveFilters={hasActiveFilters}
          onFilterChange={updateFilter}
          resetHref={buildHref(pathname, new URLSearchParams(), { tab: activeTab })}
          tokenOptions={tokenOptions}
        />

        <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">{currentTab.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{currentTab.description}</p>
            </div>
            <span className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold text-slate-300">
              {visibleItems.length} / {tabItems.length} khuyến nghị
            </span>
          </div>
          {portfolio.isLoading || proposals.isLoading || crossImpacts.isLoading ? (
            <DataSkeleton rows={4} />
          ) : (
            <div className={listClassName}>
              {visibleItems.map((item) => (
                <RecommendationCard
                  key={item.proposal._id}
                  id={item.proposal._id}
                  tokenSymbol={item.proposal.tokenSymbol ?? item.proposal.tokenName}
                  action={item.proposal.action ?? item.proposal.suggestionType}
                  confidence={item.proposal.confidence}
                  riskLevel={item.proposal.financialImpact?.riskLevel}
                  expiresAt={item.proposal.expiresAt}
                  portfolioImpact={item.impact}
                  status={item.status}
                  isWatched={item.isWatched}
                  summary={item.proposal.rationaleSummary}
                  entryPrice={item.proposal.entryPrice}
                  currentPrice={item.status === 'VERIFIED'
                    ? item.proposal.exitPrice
                    : item.proposal.livePerformance?.markPrice ?? item.proposal.financialImpact?.currentPrice ?? item.proposal.financialImpact?.currentValue}
                  projectedPnL={item.proposal.financialImpact?.projectedPnL ?? item.proposal.actualPnL}
                  quantScore={item.proposal.quantScore ?? item.proposal.scoreComponents?.finalScore}
                  roi={item.proposal.pnlPercentage ?? item.proposal.financialImpact?.roi}
                  livePerformance={item.proposal.livePerformance}
                  score={item.priorityScore}
                  showImpactBadge
                  href={`/proposal/${item.proposal._id}`}
                  onWatch={() => watchRecommendation(item.proposal)}
                />
              ))}
              {!visibleItems.length ? (
                <EmptyState
                  title={hasActiveFilters && tabItems.length ? 'Không có khuyến nghị khớp bộ lọc' : 'Chưa có khuyến nghị trong nhóm này'}
                  description={hasActiveFilters && tabItems.length
                    ? 'Thử đổi token, hành động, rủi ro, độ tin cậy, thời hạn hoặc trạng thái dữ liệu để mở rộng kết quả.'
                    : 'Khi có dữ liệu phù hợp với danh mục hoặc cơ hội ngoài ví, danh sách sẽ tự cập nhật.'}
                />
              ) : null}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

function normalizeTab(value?: string | null): RecommendationTab {
  if (value === 'portfolio' || value === 'outside-portfolio' || value === 'verified') return value;
  return 'urgent';
}

function FilterBar({
  filters,
  hasActiveFilters,
  onFilterChange,
  resetHref,
  tokenOptions,
}: {
  filters: RecommendationFilters;
  hasActiveFilters: boolean;
  onFilterChange: (key: keyof RecommendationFilters, value: string) => void;
  resetHref: string;
  tokenOptions: string[];
}) {
  return (
    <section className="rounded-xl border border-white/5 bg-black/25 p-4" aria-label="Bộ lọc nâng cao">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <FilterSelect
          id="recommendation-filter-token"
          label="Token"
          value={filters.token || 'all'}
          onChange={(value) => onFilterChange('token', value)}
          options={[
            { label: 'Tất cả token', value: 'all' },
            ...tokenOptions.map((token) => ({ label: token, value: token })),
          ]}
        />
        <FilterSelect
          id="recommendation-filter-action"
          label="Hành động"
          value={filters.action || 'all'}
          onChange={(value) => onFilterChange('action', value)}
          options={[
            { label: 'Tất cả hành động', value: 'all' },
            ...ACTION_OPTIONS.map((action) => ({ label: action, value: action })),
          ]}
        />
        <FilterSelect
          id="recommendation-filter-risk"
          label="Rủi ro"
          value={filters.risk || 'all'}
          onChange={(value) => onFilterChange('risk', value)}
          options={[
            { label: 'Tất cả rủi ro', value: 'all' },
            ...RISK_OPTIONS.map((risk) => ({ label: risk.toLowerCase(), value: risk })),
          ]}
        />
        <FilterSelect
          id="recommendation-filter-confidence"
          label="Độ tin cậy"
          value={filters.confidence === null ? 'all' : String(filters.confidence)}
          onChange={(value) => onFilterChange('confidence', value)}
          options={[
            { label: 'Tất cả độ tin cậy', value: 'all' },
            ...CONFIDENCE_OPTIONS.map((value) => ({ label: `>${value}`, value: String(value) })),
          ]}
        />
        <FilterSelect
          id="recommendation-filter-expiry"
          label="Thời hạn"
          value={filters.expiry}
          onChange={(value) => onFilterChange('expiry', value)}
          options={[
            { label: 'Tất cả thời hạn', value: 'all' },
            { label: 'Còn hiệu lực', value: 'active' },
            { label: 'Sắp hết hạn', value: 'expiring' },
          ]}
        />
        <FilterSelect
          id="recommendation-filter-data"
          label="Dữ liệu"
          value={filters.data}
          onChange={(value) => onFilterChange('data', value)}
          options={[
            { label: 'Tất cả dữ liệu', value: 'all' },
            { label: 'Đủ dữ liệu', value: 'complete' },
            { label: 'Thiếu dữ liệu', value: 'missing' },
          ]}
        />
      </div>
      <div className="mt-3 flex justify-end">
        {hasActiveFilters ? (
          <Button asChild variant="outline" className="border-white/10 text-slate-200">
            <Link href={resetHref}>Reset filters</Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled className="border-white/10 text-slate-500">
            Reset filters
          </Button>
        )}
      </div>
    </section>
  );
}

function FilterSelect({
  id,
  label,
  onChange,
  options,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-semibold text-slate-300">
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function getItemsForTab(items: RecommendationItem[], tab: RecommendationTab) {
  if (tab === 'verified') return items.filter((item) => item.status === 'VERIFIED');
  if (tab === 'outside-portfolio') {
    return items.filter((item) => item.impact === 'OUTSIDE' && isStillActionable(item.status));
  }
  if (tab === 'portfolio') {
    return items.filter((item) => ['DIRECT', 'INDIRECT'].includes(item.impact) && isStillActionable(item.status));
  }
  return items.filter((item) => isStillActionable(item.status));
}

function isStillActionable(status: RecommendationStatus) {
  return status === 'ACTIVE' || status === 'EXPIRING_SOON' || status === 'MISSING_DATA';
}

function getFilters(searchParams: URLSearchParams): RecommendationFilters {
  return {
    action: normalizeOption(searchParams.get('action'), ACTION_OPTIONS),
    confidence: normalizeConfidenceFilter(searchParams.get('confidence')),
    data: normalizeDataFilter(searchParams.get('data')),
    expiry: normalizeExpiryFilter(searchParams.get('expiry')),
    risk: normalizeOption(searchParams.get('risk'), RISK_OPTIONS),
    token: normalizeTokenFilter(searchParams.get('token')),
  };
}

function applyFilters(items: RecommendationItem[], filters: RecommendationFilters) {
  return items.filter((item) => {
    const proposal = item.proposal;
    const token = String(proposal.tokenSymbol ?? proposal.tokenName ?? '').toUpperCase();
    const action = String(proposal.action ?? proposal.suggestionType ?? '').toUpperCase();
    const risk = String(proposal.financialImpact?.riskLevel ?? '').toUpperCase();
    const confidence = Number(proposal.confidence ?? 0);

    if (filters.token && token !== filters.token) return false;
    if (filters.action && action !== filters.action) return false;
    if (filters.risk && risk !== filters.risk) return false;
    if (filters.confidence !== null && confidence <= filters.confidence) return false;
    if (filters.expiry === 'active' && !['ACTIVE', 'MISSING_DATA'].includes(item.status)) return false;
    if (filters.expiry === 'expiring' && item.status !== 'EXPIRING_SOON') return false;
    if (filters.expiry === 'expired' && item.status !== 'EXPIRED') return false;
    if (filters.data === 'complete' && item.status === 'MISSING_DATA') return false;
    if (filters.data === 'missing' && item.status !== 'MISSING_DATA') return false;
    return true;
  });
}

function getTokenOptions(proposals: ProposalData[]) {
  return Array.from(new Set(
    proposals
      .map((proposal) => normalizeTokenFilter(proposal.tokenSymbol ?? proposal.tokenName))
      .filter((token): token is string => Boolean(token))
  )).sort();
}

function buildHref(pathname: string, searchParams: URLSearchParams, updates: Record<string, string | null>) {
  const params = new URLSearchParams(searchParams.toString());
  Object.entries(updates).forEach(([key, value]) => {
    if (!value || value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });
  if (!params.get('tab')) params.set('tab', 'urgent');
  return `${pathname}?${params.toString()}`;
}

function hasFilters(filters: RecommendationFilters) {
  return Boolean(
    filters.action ||
    filters.confidence !== null ||
    filters.data !== 'all' ||
    filters.expiry !== 'all' ||
    filters.risk ||
    filters.token
  );
}

function normalizeOption<T extends readonly string[]>(value: string | null, options: T) {
  const normalized = String(value ?? '').toUpperCase();
  return options.includes(normalized as T[number]) ? normalized : '';
}

function normalizeTokenFilter(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized && normalized !== 'ALL' ? normalized : '';
}

function normalizeConfidenceFilter(value: string | null) {
  const numeric = Number(value);
  return CONFIDENCE_OPTIONS.includes(numeric as typeof CONFIDENCE_OPTIONS[number]) ? numeric : null;
}

function normalizeExpiryFilter(value: string | null): ExpiryFilter {
  if (value === 'active' || value === 'expiring' || value === 'expired') return value;
  return 'all';
}

function normalizeDataFilter(value: string | null): DataFilter {
  if (value === 'complete' || value === 'missing') return value;
  return 'all';
}

function computePriorityScore(proposal: ProposalData, impact: PortfolioImpact, status: RecommendationStatus) {
  const action = String(proposal.action ?? proposal.suggestionType ?? '').toUpperCase();
  const risk = String(proposal.financialImpact?.riskLevel ?? '').toUpperCase();
  let score = Number(proposal.confidence ?? 0);
  if (status === 'EXPIRING_SOON') score += 120;
  if (status === 'MISSING_DATA') score += 20;
  if (impact === 'DIRECT') score += 90;
  if (impact === 'INDIRECT') score += 35;
  if (action === 'SELL' || risk === 'HIGH' || risk === 'CRITICAL') score += 45;
  return score;
}
