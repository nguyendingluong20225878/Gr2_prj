'use client';

import Link from 'next/link';
import { Layout } from '@/app/components/layout/Layout';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useNdlData, type Holding, type ProposalData } from '@/lib/hooks/useNdlData';
import { formatConfidence, normalizeConfidenceValue, toDisplayAction } from '@/lib/utils/formatters';
import { getLatestActiveProposalPerToken } from '@/lib/utils/proposals';

type PriorityGroup = 'urgent' | 'today' | 'watch';

type ScoreBreakdown = {
  urgency: number;
  relevance: number;
  actionWeight: number;
  risk: number;
  confidence: number;
  dataPenalty: number;
};

type PrioritizedProposal = ProposalData & {
  priorityScore: number;
  priorityGroup: PriorityGroup;
  scoreBreakdown: ScoreBreakdown;
};

export default function RecommendationsPage() {
  const { portfolio, proposals } = useNdlData();
  const holdings = portfolio.data?.holdings ?? [];
  const proposalList = getLatestActiveProposalPerToken(proposals.data ?? []);
  const groups = groupByPriority(proposalList, holdings);

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Khuyến nghị hành động"
          title="Việc cần xử lý hôm nay"
          description="Các proposal được xếp theo điểm ưu tiên dựa trên thời hạn, token bạn đang giữ, action, risk, confidence và chất lượng dữ liệu có sẵn."
          actions={
            <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
              <Link href="/portfolio">Xem tài sản đang có</Link>
            </Button>
          }
        />

        {portfolio.isLoading || proposals.isLoading ? (
          <DataSkeleton rows={4} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Group
              title="Cần xử lý ngay"
              description="Ưu tiên cao vì có yếu tố gấp như sắp hết hạn, liên quan holdings, SELL, risk hoặc confidence cao."
              items={groups.urgent}
              empty="Không có việc cần xử lý ngay."
            />
            <Group
              title="Nên xem hôm nay"
              description="Có điểm ưu tiên trung bình, đáng mở chi tiết trước khi quyết định hành động."
              items={groups.today}
              empty="Không có khuyến nghị cần xem hôm nay."
            />
            <Group
              title="Theo dõi thêm"
              description="Điểm ưu tiên thấp hơn, thường là cơ hội ngoài danh mục hoặc chưa đủ yếu tố để xử lý ngay."
              items={groups.watch}
              empty="Chưa có cơ hội mới."
            />
          </div>
        )}
      </div>
    </Layout>
  );
}

function Group({ title, description, items, empty }: { title: string; description: string; items: PrioritizedProposal[]; empty: string }) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-4 space-y-3">
        {items.map((proposal) => (
          <RecommendationItem key={proposal._id} proposal={proposal} />
        ))}
        {!items.length ? <EmptyState title={empty} /> : null}
      </div>
    </section>
  );
}

function RecommendationItem({ proposal }: { proposal: PrioritizedProposal }) {
  const action = proposal.action ?? proposal.suggestionType;

  return (
    <Link href={`/proposal/${proposal._id}`} className="block rounded-xl border border-white/5 bg-black/40 p-4 transition-colors hover:border-cyan-500/30 hover:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-white">{proposal.tokenSymbol ?? 'TOKEN'}</span>
            <Badge className={actionBadgeClass(action)} variant="outline">{toDisplayAction(action)}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-300">{getPrimaryReason(proposal)}</p>
        </div>
        <span className="text-sm font-bold text-cyan-300">{formatConfidence(proposal.confidence)}</span>
      </div>
    </Link>
  );
}

function groupByPriority(proposals: ProposalData[], holdings: Holding[]) {
  const groups: Record<PriorityGroup, PrioritizedProposal[]> = {
    urgent: [],
    today: [],
    watch: [],
  };

  const sorted = proposals
    .map((proposal) => {
      const scoreBreakdown = explainScore(proposal, holdings);
      const priorityScore = computePriorityScore(scoreBreakdown);
      const priorityGroup = getPriorityGroup(priorityScore);
      return { ...proposal, priorityScore, priorityGroup, scoreBreakdown };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  sorted.forEach((proposal) => groups[proposal.priorityGroup].push(proposal));
  return groups;
}

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

function explainScore(proposal: ProposalData, holdings: Holding[]): ScoreBreakdown {
  const isHolding = isProposalHolding(proposal, holdings);
  const hoursLeft = getHoursLeft(proposal.expiresAt);
  const riskLevel = String(proposal.financialImpact?.riskLevel ?? '').toUpperCase();
  const action = String(proposal.action ?? proposal.suggestionType ?? '').toUpperCase();
  const confidenceValue = normalizeConfidence(proposal.confidence);
  const sampleSize = proposal.signalContext?.metadata?.sampleSize;
  const currentPrice = proposal.financialImpact?.currentPrice ?? proposal.entryPrice;

  let urgency = 0;
  if (hoursLeft !== null) {
    if (hoursLeft < 2) urgency = 3;
    else if (hoursLeft < 6) urgency = 2;
    else if (hoursLeft < 24) urgency = 1;
  }

  let actionWeight = 0;
  if (action === 'SELL') actionWeight = 2;
  else if (action === 'BUY') actionWeight = 1;

  let risk = 0;
  if (riskLevel === 'HIGH') risk = 2;
  else if (riskLevel === 'MEDIUM') risk = 1;

  let dataPenalty = 0;
  if (currentPrice !== undefined && currentPrice !== null && currentPrice <= 0) dataPenalty -= 1;
  if (sampleSize !== undefined && sampleSize < 5) dataPenalty -= 1;

  return {
    urgency,
    relevance: isHolding ? 2 : 0,
    actionWeight,
    risk,
    confidence: confidenceValue * 2,
    dataPenalty,
  };
}

function computePriorityScore(score: ScoreBreakdown) {
  return (
    score.urgency * 1.5 +
    score.relevance * 1.2 +
    score.actionWeight * 1.2 +
    score.risk +
    score.confidence * 1.5 +
    score.dataPenalty
  );
}

function getPriorityGroup(score: number): PriorityGroup {
  if (score >= 7) return 'urgent';
  if (score >= 4) return 'today';
  return 'watch';
}

function getPrimaryReason(proposal: PrioritizedProposal) {
  const hoursLeft = getHoursLeft(proposal.expiresAt);
  const action = String(proposal.action ?? proposal.suggestionType ?? '').toUpperCase();
  const riskLevel = String(proposal.financialImpact?.riskLevel ?? '').toUpperCase();
  const confidence = normalizeConfidenceValue(proposal.confidence);
  const token = proposal.tokenSymbol ?? 'Token này';

  if (hoursLeft !== null && hoursLeft < 6) {
    return `Sắp hết hạn trong ${Math.max(0, Math.round(hoursLeft))}h`;
  }

  if (proposal.scoreBreakdown.relevance > 0 && action === 'SELL') {
    return 'Bạn đang giữ token này và có tín hiệu SELL';
  }

  if (riskLevel === 'HIGH') {
    return 'Rủi ro cao theo mô hình';
  }

  if (proposal.scoreBreakdown.relevance > 0) {
    return `${token} nằm trong danh mục của bạn`;
  }

  if (confidence !== null && confidence >= 70) {
    return `${token} có confidence cao`;
  }

  return `${token} chưa có trong danh mục`;
}

function isProposalHolding(proposal: ProposalData, holdings: Holding[]) {
  const symbol = String(proposal.tokenSymbol ?? '').toUpperCase();
  return Boolean(symbol) && holdings.some((holding) => holding.symbol.toUpperCase() === symbol);
}

function getHoursLeft(value?: string | Date | null) {
  if (!value) return null;
  const expiresAt = new Date(value).getTime();
  if (!Number.isFinite(expiresAt)) return null;
  return (expiresAt - Date.now()) / 3_600_000;
}

function normalizeConfidence(value?: number | null) {
  if (value === null || value === undefined) return 0;
  return clamp(value > 1 ? value / 100 : value);
}

function actionBadgeClass(action?: string | null) {
  const upper = String(action ?? '').toUpperCase();
  if (upper === 'BUY' || upper === 'LONG') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (upper === 'SELL' || upper === 'SHORT') return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (upper === 'HOLD' || upper === 'WAIT') return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
  return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
}
