'use client';

import Link from 'next/link';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, HelpCircle, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { CountdownBadge, DataSkeleton, EmptyState, ExplanationDrawer } from '@/app/components/shared/NdlUi';
import ProposalAccuracyChart from './ProposalAccuracyChart';
import {
  useProposalDetail,
  useProposalScoreExplanation,
  useProposalTimeline,
  useNdlData,
  type ProposalData,
  type ScoreExplanationData,
} from '@/lib/hooks/useNdlData';
import {
  formatCurrency,
  formatConfidence,
  formatNumber,
  formatPercent,
  normalizePercentValue,
  toDisplayAction,
  toDisplayRisk,
} from '@/lib/utils/formatters';
import { formatExpiry, formatVietnameseDateTime, isExpired } from '@/lib/utils/time';
import {
  derivePortfolioImpact,
  deriveRecommendationStatus,
  getPortfolioImpactLabel,
  getRecommendationStatusLabel,
  hasVerificationResult,
  type PortfolioImpact,
  type RecommendationStatus,
} from '@/lib/utils/recommendationDerivation';

export default function ProposalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const proposal = useProposalDetail(id);
  const timeline = useProposalTimeline(id);
  const scoreExplanation = useProposalScoreExplanation(id);
  const { portfolio, crossImpacts, watchlist, modelHealth } = useNdlData();
  const data = proposal.data;
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [showFullRationale, setShowFullRationale] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const dataStatus = useMemo(() => data ? getDataStatus(data, timeline.data?.missingData) : [], [data, timeline.data]);
  const portfolioImpact = useMemo(() => data ? derivePortfolioImpact({
    proposal: data,
    holdings: portfolio.data?.holdings,
    crossImpacts: crossImpacts.data,
  }) : 'UNKNOWN', [data, portfolio.data?.holdings, crossImpacts.data]);
  const recommendationStatus = useMemo(() => data ? deriveRecommendationStatus(data) : 'ACTIVE', [data]);
  const systemBadge = getSystemBadge(modelHealth.data);

  const submitDecision = async (decision: 'WAIT' | 'REJECT') => {
    if (!data) return;
    setSubmitting(decision);
    try {
      const response = await fetch(`/api/proposals/${data._id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: decision === 'WAIT' ? 'Theo dõi khuyến nghị, chờ vùng giá phù hợp' : 'Từ chối khuyến nghị từ màn chi tiết',
          snapshot: {
            tokenSymbol: data.tokenSymbol,
            action: data.action,
            confidence: data.confidence,
            quantScore: data.quantScore,
          },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Không ghi nhận được quyết định');

      if (decision === 'WAIT') {
        const watchResponse = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proposalId: data._id,
            addedBy: 'USER',
            reason: 'Theo dõi khuyến nghị, chờ kiểm chứng hoặc vùng giá phù hợp',
            status: 'WATCHING',
          }),
        });
        const watchBody = await watchResponse.json().catch(() => ({}));
        if (!watchResponse.ok) {
          toast.warning(watchBody.error || 'Đã ghi quyết định, nhưng chưa thêm được vào watchlist.');
        } else {
          toast.success('Đã ghi quyết định và đưa vào theo dõi.');
        }
      } else {
        toast.success('Đã từ chối khuyến nghị.');
      }
      await proposal.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không ghi nhận được quyết định');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {proposal.isLoading ? (
          <DataSkeleton rows={4} />
        ) : !data ? (
          <EmptyState title="Không tìm thấy khuyến nghị" />
        ) : (
          <>
            <DecisionHeader
              data={data}
              dataStatus={dataStatus}
              portfolioImpact={portfolioImpact}
              status={recommendationStatus}
              isWatched={Boolean(watchlist.data?.some((item) => item.proposalId === data._id || item.proposal?._id === data._id))}
              trustLabel={systemBadge.label}
              trustClassName={systemBadge.className}
              explanation={scoreExplanation.data}
              explanationError={scoreExplanation.error}
              explanationLoading={scoreExplanation.isLoading}
              submitting={submitting}
              onBack={() => router.back()}
              onWait={() => submitDecision('WAIT')}
              onReject={() => submitDecision('REJECT')}
            />

            <RationaleSection
              data={data}
              expanded={showFullRationale}
              onToggle={() => setShowFullRationale((value) => !value)}
            />

            <DecisionSupportSection data={data} />

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Backtest TOKEN</p>
                  <h2 className="mt-1 text-lg font-bold text-white">Backtest TOKEN: {timeline.data?.token.symbol ?? data.tokenSymbol ?? data.tokenName ?? 'Token chưa định danh'}</h2>
                  <p className="mt-1 text-sm text-slate-500">Lịch sử giá và độ đúng của các khuyến nghị tương tự.</p>
                </div>
                <Legend />
              </div>
              {timeline.isLoading ? (
                <DataSkeleton rows={3} />
              ) : timeline.data ? (
                <ProposalAccuracyChart timeline={timeline.data} />
              ) : (
                <EmptyState title="Chưa tải được timeline" description="Chưa đủ dữ liệu timeline cho khuyến nghị này." />
              )}
            </section>

            <section className="rounded-xl border border-white/5 bg-black/30 p-4 text-sm text-slate-400">
              NDL không phải cố vấn tài chính. Khuyến nghị chỉ là dữ liệu hỗ trợ quyết định. Bạn chịu trách nhiệm với mọi giao dịch.
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Advanced</p>
                  <h2 className="mt-1 text-lg font-bold text-white">Chi tiết nâng cao</h2>
                  <p className="mt-1 text-sm text-slate-500">Điểm tín hiệu, nguồn dữ liệu và breakdown kỹ thuật được gom tại đây.</p>
                </div>
                <Button onClick={() => setShowAdvanced((value) => !value)} variant="outline" className="border-white/10 text-slate-200">
                  {showAdvanced ? 'Ẩn chi tiết nâng cao' : 'Xem chi tiết nâng cao'}
                </Button>
              </div>
              {showAdvanced ? (
                <div className="mt-5 space-y-4">
                  <section className="grid gap-4 lg:grid-cols-2">
                    <ConfidenceCard data={data} />
                    <SignalScoreCard data={data} />
                  </section>
                  <WhyScoreSection data={data} explanation={scoreExplanation.data} />
                  <KeyInformation data={data} dataStatus={dataStatus} />
                  <DataSources data={data} />
                </div>
              ) : null}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function DecisionHeader({
  data,
  dataStatus,
  portfolioImpact,
  status,
  isWatched,
  trustLabel,
  trustClassName,
  explanation,
  explanationError,
  explanationLoading,
  submitting,
  onBack,
  onWait,
  onReject,
}: {
  data: ProposalData;
  dataStatus: string[];
  portfolioImpact: PortfolioImpact;
  status: RecommendationStatus;
  isWatched: boolean;
  trustLabel: string;
  trustClassName: string;
  explanation?: ScoreExplanationData;
  explanationError?: unknown;
  explanationLoading: boolean;
  submitting: string | null;
  onBack: () => void;
  onWait: () => void;
  onReject: () => void;
}) {
  const [confidenceDrawerOpen, setConfidenceDrawerOpen] = useState(false);
  const [signalScoreDrawerOpen, setSignalScoreDrawerOpen] = useState(false);
  const completed = hasVerificationResult(data);
  const expired = isExpired(data.expiresAt);
  const executed = status === 'EXECUTED';
  const actionable = !completed && !expired && !executed;
  const canPrepareTrade = actionable && !executed;
  const canWatchData = actionable && !executed;
  const signalScore = data.quantScore ?? data.scoreComponents?.finalScore ?? null;
  const observedAt = getProposalObservedAt(data);
  const disabledReason = expired
    ? 'Tín hiệu đã hết hiệu lực. Không nên xem đây là cơ hội hành động mới.'
    : executed
      ? 'Khuyến nghị đã được thực hiện, không mở thêm luồng giao dịch mới từ màn này.'
    : completed
      ? 'Khuyến nghị đã có kết quả kiểm chứng, chỉ nên dùng để tham khảo.'
      : null;

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Button>
        <Link href="/model-health" className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold ${trustClassName}`}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {trustLabel}
        </Link>
      </div>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Chi tiết khuyến nghị</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black text-white">{data.tokenSymbol ?? data.tokenName ?? 'Token chưa định danh'}</h1>
            <Badge className={actionTone(data.action ?? data.suggestionType)} variant="outline">
              {toDisplayAction(data.action ?? data.suggestionType)}
            </Badge>
            <PortfolioImpactBadge impact={portfolioImpact} />
            {status !== 'MISSING_DATA' ? <StatusBadge status={status} /> : null}
            {isWatched ? <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" variant="outline">Đã theo dõi</Badge> : null}
            {!completed ? <CountdownBadge value={data.expiresAt} /> : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Mini
              label="Độ tin cậy"
              value={<StatWithHelp value={formatConfidence(data.confidence)} onClick={() => setConfidenceDrawerOpen(true)} />}
            />
            <Mini
              label="Điểm tín hiệu"
              value={<StatWithHelp value={signalScore === null ? 'Chưa có dữ liệu' : formatNumber(signalScore, 2)} onClick={() => setSignalScoreDrawerOpen(true)} />}
            />
            <Mini label="Rủi ro" value={toDisplayRisk(data.financialImpact?.riskLevel)} />
            <Mini label="Thời hạn" value={formatExpiry(data.expiresAt)} />
            <Mini label="Ảnh hưởng danh mục" value={getPortfolioImpactLabel(portfolioImpact)} />
            <Mini label="Ghi nhận tín hiệu" value={formatVietnameseDateTime(observedAt)} />
            <Mini label="Cập nhật" value={formatVietnameseDateTime(data.updatedAt ?? data.createdAt)} />
          </div>
          {disabledReason ? (
            <div className="mt-4 flex max-w-2xl gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>{disabledReason}</span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 xl:max-w-xs xl:justify-end">
          {canWatchData ? (
            canPrepareTrade ? (
              <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                <Link href={`/proposal/${data._id}/trade`}>Chuẩn bị giao dịch</Link>
              </Button>
            ) : (
              <Button onClick={onWait} disabled={Boolean(submitting)} className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                {submitting === 'WAIT' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Theo dõi dữ liệu
              </Button>
            )
          ) : (
            <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
              <Link href={data.tokenSymbol ? `/tokens/${encodeURIComponent(data.tokenSymbol)}` : '/recommendations'}>Xem lịch sử token</Link>
            </Button>
          )}
          {canWatchData ? (
            <Button onClick={onReject} disabled={Boolean(submitting)} variant="outline" className="border-white/10 text-slate-300">
              {submitting === 'REJECT' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Từ chối
            </Button>
          ) : null}
        </div>
      </div>
      <ConfidenceExplanationDrawer
        data={data}
        explanation={explanation}
        hasError={Boolean(explanationError)}
        loading={explanationLoading}
        onOpenChange={setConfidenceDrawerOpen}
        open={confidenceDrawerOpen}
      />
      <SignalScoreExplanationDrawer
        data={data}
        explanation={explanation}
        hasError={Boolean(explanationError)}
        loading={explanationLoading}
        onOpenChange={setSignalScoreDrawerOpen}
        open={signalScoreDrawerOpen}
      />
    </section>
  );
}

function StatWithHelp({ href, onClick, value }: { href?: string; onClick?: () => void; value: React.ReactNode }) {
  const className = 'inline-flex h-6 items-center gap-1 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 text-[11px] font-semibold text-cyan-200 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
      <span className="min-w-0">{value}</span>
      {onClick ? (
        <button type="button" onClick={onClick} className={className} title="Xem cách tính">
          <HelpCircle className="h-3.5 w-3.5" />
          Giải thích
        </button>
      ) : href ? (
        <Link href={href} className={className} title="Xem cách tính">
          <HelpCircle className="h-3.5 w-3.5" />
          Giải thích
        </Link>
      ) : null}
    </span>
  );
}

function clampScore(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeConfidencePercent(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const numericValue = Number(value);
  return clampScore(numericValue <= 1 ? numericValue * 100 : numericValue, 0, 100);
}

function getConfidenceTone(value: number | null) {
  if (value === null) return {
    bar: 'bg-slate-500',
    border: 'border-slate-500/20',
    label: 'Chưa có dữ liệu',
    text: 'text-slate-300',
    track: 'bg-slate-500/10',
  };
  if (value < 50) return {
    bar: 'bg-red-400',
    border: 'border-red-500/25',
    label: 'Thấp',
    text: 'text-red-200',
    track: 'bg-red-500/10',
  };
  if (value < 75) return {
    bar: 'bg-amber-300',
    border: 'border-amber-500/25',
    label: 'Cần kiểm tra',
    text: 'text-amber-100',
    track: 'bg-amber-500/10',
  };
  return {
    bar: 'bg-green-300',
    border: 'border-green-500/25',
    label: 'Mạnh',
    text: 'text-green-100',
    track: 'bg-green-500/10',
  };
}

function ConfidenceMeter({ description, value }: { description?: string; value?: number | null }) {
  const percent = normalizeConfidencePercent(value);
  const tone = getConfidenceTone(percent);

  return (
    <div className={`rounded-lg border ${tone.border} bg-black/30 p-4`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Độ tin cậy</p>
          <p className={`mt-1 text-3xl font-black ${tone.text}`}>{percent === null ? 'Chưa có dữ liệu' : `${formatNumber(percent, 0)}%`}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone.track} ${tone.text}`}>{tone.label}</span>
      </div>
      <div className={`mt-4 h-2 rounded-full ${tone.track}`}>
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${percent ?? 0}%` }} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        {description ?? 'Đây là mức hệ thống tin vào luận điểm hiện tại, không phải xác suất chắc chắn có lời.'}
      </p>
    </div>
  );
}

function getQuantLabel(score: number | null) {
  if (score === null) return { label: 'Chưa có dữ liệu', text: 'text-slate-300' };
  if (score > 1) return { label: 'Nghiêng bullish', text: 'text-green-200' };
  if (score < -1) return { label: 'Nghiêng bearish', text: 'text-red-200' };
  return { label: 'Gần trung lập', text: 'text-slate-300' };
}

function QuantGauge({ value }: { value?: number | null }) {
  const score = value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
  const clamped = score === null ? 0 : clampScore(score, -3, 3);
  const markerLeft = ((clamped + 3) / 6) * 100;
  const tone = getQuantLabel(score);

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Quant Z-Score</p>
          <p className={`mt-1 text-3xl font-black ${tone.text}`}>{score === null ? 'N/A' : formatNumber(score, 2)}</p>
        </div>
        <span className={`rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold ${tone.text}`}>{tone.label}</span>
      </div>
      <div className="relative mt-5 h-3 rounded-full bg-gradient-to-r from-red-500/80 via-slate-500/40 to-green-400/80">
        <div className="absolute left-1/2 top-1/2 h-7 w-px -translate-y-1/2 bg-white/60" />
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-950 shadow-lg shadow-black/40"
          style={{ left: `${markerLeft}%` }}
        />
      </div>
      <div className="mt-2 grid grid-cols-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        <span>Bearish</span>
        <span className="text-center">0</span>
        <span className="text-right">Bullish</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Điểm dương cho thấy tín hiệu nổi bật theo hướng bullish; điểm âm nghiêng bearish. Gauge được kẹp trong vùng -3 đến +3 để tránh một outlier làm méo hiển thị.
      </p>
    </div>
  );
}

function ConfidenceExplanationDrawer({
  data,
  explanation,
  hasError,
  loading,
  onOpenChange,
  open,
}: {
  data: ProposalData;
  explanation?: ScoreExplanationData;
  hasError: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const confidence = explanation?.displayConfidence ?? explanation?.confidence ?? data.confidence;
  const reasonCards = explanation?.reasonCards?.filter((card) => card.visible) ?? [];
  const primaryExplanation = explanation?.primaryExplanation
    ?? 'Đây là mức hệ thống tin vào luận điểm hiện tại, không phải xác suất chắc chắn có lời.';

  return (
    <ExplanationDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Độ tin cậy của khuyến nghị"
      description="Đây là mức hệ thống tin vào luận điểm hiện tại, không phải xác suất chắc chắn có lời."
      footer={explanation?.auditAvailable ? (
        <div>
          <Button asChild variant="outline" className="w-full border-cyan-500/30 text-cyan-300">
            <Link href={`/proposal/${data._id}/explanation/confidence`}>Xem audit chi tiết</Link>
          </Button>
        </div>
      ) : null}
    >
      {loading ? (
        <DataSkeleton rows={3} />
      ) : (
        <div className="space-y-4">
          {hasError && !explanation ? (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
              Chưa đủ dữ liệu giải thích chi tiết cho mức tin cậy này.
            </p>
          ) : null}
          <ConfidenceMeter value={confidence} description={primaryExplanation} />
          <section className="rounded-lg border border-white/5 bg-black/20 p-4">
            <h3 className="font-semibold text-white">Vì sao có mức tin cậy này?</h3>
            {reasonCards.length ? (
              <div className="mt-3 space-y-3">
                {reasonCards.map((card) => <ConfidenceReasonCard key={card.id} card={card} />)}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-500">Chưa đủ dữ liệu giải thích chi tiết cho mức tin cậy này.</p>
            )}
          </section>
        </div>
      )}
    </ExplanationDrawer>
  );
}

function ConfidenceReasonCard({ card }: { card: NonNullable<ScoreExplanationData['reasonCards']>[number] }) {
  const tone = card.tone === 'positive'
    ? 'border-green-500/20 bg-green-500/10 text-green-100'
    : card.tone === 'caution'
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-100'
      : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100';

  return (
    <article className={`rounded-lg border p-3 ${tone}`}>
      <p className="font-semibold text-white">{card.title}</p>
      <p className="mt-2 text-sm leading-6">{card.body}</p>
    </article>
  );
}

function DrawerSection({ empty, items, title }: { title: string; items: string[]; empty?: string }) {
  const safeItems = items.filter(Boolean);
  return (
    <section className="rounded-lg border border-white/5 bg-black/30 p-3">
      <h3 className="font-semibold text-white">{title}</h3>
      {safeItems.length ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
          {safeItems.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{empty ?? 'Chưa có dữ liệu.'}</p>
      )}
    </section>
  );
}

function readableMissingData(value: string) {
  const key = value.toLowerCase();
  if (key.includes('source')) return 'Thiếu nguồn dữ liệu liên kết.';
  if (key.includes('price')) return 'Thiếu dữ liệu giá.';
  if (key.includes('confidence')) return 'Thiếu độ tin cậy đầu vào.';
  if (key.includes('sample')) return 'Thiếu cỡ mẫu đủ dày.';
  return value;
}

function isTechnicalText(value: string) {
  return /confidenceDivisor|coldStartConfidenceDivisor|pipeline|\/api\/|raw json/i.test(value);
}

function SignalScoreExplanationDrawer({
  data,
  explanation,
  hasError,
  loading,
  onOpenChange,
  open,
}: {
  data: ProposalData;
  explanation?: ScoreExplanationData;
  hasError: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const finalScore = explanation?.finalScore ?? data.quantScore ?? data.scoreComponents?.finalScore ?? null;
  const missingItems = getSignalScoreMissingItems(data, explanation);

  return (
    <ExplanationDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Cách tính điểm tín hiệu"
      value={finalScore === null ? 'Chưa có dữ liệu' : formatNumber(finalScore, 2)}
      description="Điểm tín hiệu cho biết dữ liệu hiện tại nổi bật thế nào so với lịch sử và bối cảnh thị trường."
      footer={
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-400">
            Công thức dễ đọc: so sánh độ bất thường của token với lịch sử, thị trường cùng thời điểm, yếu tố thời gian và phần dữ liệu còn thiếu.
          </p>
          <div className="rounded-lg border border-white/5 bg-black/30 p-3 text-sm text-slate-300">
            <p className="font-semibold text-white">Các vùng điểm</p>
            <ul className="mt-2 space-y-1">
              <li>&gt; 2.0: tín hiệu mạnh.</li>
              <li>1.0 - 2.0: tín hiệu đáng chú ý.</li>
              <li>-1.0 - 1.0: trung lập.</li>
              <li>&lt; -1.0: tín hiệu nghiêng bán hoặc rủi ro.</li>
            </ul>
          </div>
          <Button asChild variant="outline" className="w-full border-cyan-500/30 text-cyan-300">
            <Link href={`/proposal/${data._id}/explanation/quant`}>Xem breakdown kỹ thuật</Link>
          </Button>
        </div>
      }
    >
      {loading ? (
        <DataSkeleton rows={3} />
      ) : (
        <div className="space-y-4">
          {(hasError && !explanation) || finalScore === null ? (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
              Chưa đủ dữ liệu để giải thích điểm tín hiệu.
            </p>
          ) : null}
          <QuantGauge value={finalScore} />
          {missingItems.length ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
              <p className="font-semibold">Dữ liệu cần bổ sung</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {missingItems.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}
          <DrawerSection
            title="Độ lệch giá / volume bất thường"
            items={getAnomalyItems(data, explanation)}
            empty="Chưa có đủ dữ liệu bất thường giá hoặc volume."
          />
          <DrawerSection
            title="Bối cảnh thị trường"
            items={getMarketContextItems(explanation)}
            empty="Chưa có bối cảnh thị trường rõ ràng trong dữ liệu hiện có."
          />
          <DrawerSection
            title="Yếu tố thời điểm"
            items={getTimingItems(data, explanation)}
            empty="Chưa có yếu tố thời điểm nổi bật."
          />
          <DrawerSection
            title="Ảnh hưởng liên quan"
            items={getRelatedImpactItems(explanation)}
            empty="Chưa ghi nhận ảnh hưởng liên quan đáng kể."
          />
          <DrawerSection
            title="Điểm trừ nhiễu / dữ liệu thiếu"
            items={getNoisePenaltyItems(data, explanation)}
            empty="Chưa ghi nhận nhiễu hoặc dữ liệu thiếu đáng kể."
          />
          <DrawerSection
            title="Chế độ tín hiệu"
            items={[getSignalModeExplanation(data.signalMode ?? explanation?.signalMode)]}
          />
        </div>
      )}
    </ExplanationDrawer>
  );
}

function getAnomalyItems(data: ProposalData, explanation?: ScoreExplanationData) {
  const pureAlpha = explanation?.scoreComponents?.pureAlphaZ ?? data.scoreComponents?.pureAlphaZ;
  const factor = getFactorByKeywords(explanation, ['price', 'volume', 'alpha', 'bất thường', 'giá']);
  const items: string[] = [];
  if (pureAlpha !== null && pureAlpha !== undefined) {
    items.push(`Độ lệch so với lịch sử token: ${formatNumber(Number(pureAlpha), 2)}.`);
  }
  if (factor) items.push(factor);
  return items;
}

function getMarketContextItems(explanation?: ScoreExplanationData) {
  const cross = explanation?.scoreComponents?.crossZ;
  const factor = getFactorByKeywords(explanation, ['market', 'thị trường', 'bối cảnh', 'cross']);
  const items: string[] = [];
  if (cross !== null && cross !== undefined) {
    items.push(`Mức nổi bật so với thị trường: ${formatNumber(Number(cross), 2)}.`);
  }
  if (factor) items.push(factor);
  return items;
}

function getTimingItems(data: ProposalData, explanation?: ScoreExplanationData) {
  const timeZ = explanation?.scoreComponents?.timeZ ?? data.scoreComponents?.timeZ;
  const factor = getFactorByKeywords(explanation, ['time', 'thời điểm', 'fresh', 'mới']);
  const items: string[] = [];
  if (timeZ !== null && timeZ !== undefined) {
    items.push(`Yếu tố thời điểm: ${formatNumber(Number(timeZ), 2)}.`);
  }
  if (getProposalObservedAt(data)) items.push(`Tín hiệu được ghi nhận: ${formatVietnameseDateTime(getProposalObservedAt(data))}.`);
  if (factor) items.push(factor);
  return items;
}

function getRelatedImpactItems(explanation?: ScoreExplanationData) {
  const cross = explanation?.scoreComponents?.crossZ;
  if (cross === null || cross === undefined) return [];
  return [`Ảnh hưởng liên quan tới bối cảnh hoặc nhóm token: ${formatNumber(Number(cross), 2)}.`];
}

function getNoisePenaltyItems(data: ProposalData, explanation?: ScoreExplanationData) {
  const items: string[] = [];
  if (data.uncertaintyEntropy !== null && data.uncertaintyEntropy !== undefined) {
    items.push(`Độ nhiễu tín hiệu: ${formatNumber(data.uncertaintyEntropy, 2)}.`);
  }
  if (data.realizedVolatility !== null && data.realizedVolatility !== undefined) {
    items.push(`Biến động thực tế gần đây: ${formatNumber(data.realizedVolatility, 2)}.`);
  }
  getSignalScoreMissingItems(data, explanation).forEach((item) => items.push(item));
  return items;
}

function getSignalScoreMissingItems(data: ProposalData, explanation?: ScoreExplanationData) {
  const items = new Set<string>();
  if (data.quantScore === null && data.scoreComponents?.finalScore === undefined && explanation?.finalScore === undefined) {
    items.add('Thiếu điểm tín hiệu tổng hợp.');
  }
  if (!data.sources?.length && !data.signalContext?.sources?.length) items.add('Thiếu nguồn dữ liệu liên kết.');
  (explanation?.missingData ?? [])
    .map(readableMissingData)
    .filter((item) => !isTechnicalText(item))
    .forEach((item) => items.add(item));
  return Array.from(items);
}

function getSignalModeExplanation(value?: string | null) {
  const mode = String(value ?? '').toUpperCase();
  if (mode === 'COLD_START') {
    return 'Token còn ít lịch sử, điểm tín hiệu có thể biến động mạnh hơn bình thường.';
  }
  if (mode === 'NORMALIZED_ALPHA') {
    return 'Token có đủ lịch sử hơn để so sánh với mẫu quá khứ.';
  }
  return 'Chưa xác định rõ chế độ tín hiệu, nên nên đọc điểm này thận trọng.';
}

function getFactorByKeywords(explanation: ScoreExplanationData | undefined, keywords: string[]) {
  const factors = [...(explanation?.positiveFactors ?? []), ...(explanation?.negativeFactors ?? [])];
  return factors.find((factor) => {
    const text = factor.toLowerCase();
    return !isTechnicalText(factor) && keywords.some((keyword) => text.includes(keyword));
  });
}

function DecisionSupportSection({ data }: { data: ProposalData }) {
  const currentPrice = data.financialImpact?.currentPrice ?? data.financialImpact?.currentValue;
  const targetValue = data.financialImpact?.targetPrice ?? data.financialImpact?.projectedValue;
  const roi = normalizePercentValue(data.pnlPercentage ?? data.financialImpact?.roi);
  const projectedReturn = roi === null
    ? formatCurrency(data.financialImpact?.projectedPnL ?? data.actualPnL)
    : formatPercent(roi);

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Dữ liệu xem xét</p>
        <h2 className="mt-1 text-lg font-bold text-white">Snapshot trước khi quyết định</h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Các số dưới đây là dữ liệu tham khảo tại thời điểm xem. Kết quả kiểm chứng cuối cùng được cập nhật sau mốc 24h hoặc khi khuyến nghị hết hiệu lực.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Mini label="Giá tham chiếu hiện tại" value={formatCurrency(currentPrice)} />
        <Mini label="Giá vào đề xuất" value={formatCurrency(data.entryPrice ?? data.financialImpact?.currentPrice)} />
        <Mini label="Mục tiêu / giá kỳ vọng" value={formatCurrency(targetValue)} />
        <Mini label="PnL/ROI kỳ vọng" value={projectedReturn} />
        <Mini label="Rủi ro" value={toDisplayRisk(data.financialImpact?.riskLevel)} />
        <Mini label="Mốc kiểm chứng 24h" value={formatVietnameseDateTime(data.expiresAt)} />
      </div>
    </section>
  );
}

function RationaleSection({ data, expanded, onToggle }: { data: ProposalData; expanded: boolean; onToggle: () => void }) {
  const rationale = data.summary ?? data.rationaleSummary ?? 'Chưa có luận điểm ngắn cho khuyến nghị này.';
  const bullets = (data.reason ?? [])
    .map((reason) => reason.trim())
    .filter((reason) => reason.length > 0 && reason !== rationale);

  return (
    <section className="glass-card rounded-xl border border-cyan-500/15 bg-cyan-950/10 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Giải thích lí do</p>
      <p className={`mt-4 text-sm leading-6 text-slate-200 ${expanded ? 'whitespace-pre-line' : 'line-clamp-5'}`}>{rationale}</p>
      {bullets.length > 1 ? (
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {(expanded ? bullets : bullets.slice(0, 4)).map((reason) => (
            <li key={reason} className="rounded-lg border border-white/5 bg-black/30 px-3 py-2">{reason}</li>
          ))}
        </ul>
      ) : null}
      {(rationale.length > 220 || bullets.length > 4) ? (
        <Button onClick={onToggle} variant="outline" className="mt-4 border-cyan-500/30 text-cyan-300">
          {expanded ? 'Thu gọn' : 'Xem thêm lý do'}
        </Button>
      ) : null}
    </section>
  );
}

function ConfidenceCard({ data }: { data: ProposalData }) {
  const level = confidenceLevel(data.confidence);
  const isColdStart = data.signalMode === 'COLD_START';

  return (
    <MetricCard
      title="Tin cậy"
      value={data.confidence === null || data.confidence === undefined ? 'Chưa có dữ liệu' : `${data.confidence}%`}
      level={level}
      body={
        isColdStart
          ? 'Không phải xác suất có lời. Token còn ít lịch sử nên độ tin cậy bị giới hạn chặt hơn bình thường.'
          : 'Không phải xác suất có lời. Độ tin cậy đã được giảm thận trọng nếu dữ liệu lịch sử còn mỏng.'
      }
      href={`/proposal/${data._id}/explanation/confidence`}
      cta="Xem cách tính độ tin cậy"
    />
  );
}

function SignalScoreCard({ data }: { data: ProposalData }) {
  const quant = data.quantScore ?? data.scoreComponents?.finalScore ?? null;
  const direction = quant === null ? 'Chưa đủ dữ liệu' : quant > 0 ? 'Nghiêng mua' : quant < 0 ? 'Nghiêng bán' : 'Trung lập';

  return (
    <MetricCard
      title="Điểm tín hiệu"
      value={quant === null ? 'Chưa có dữ liệu' : formatNumber(quant, 2)}
      level={direction}
      body="Điểm tín hiệu đo mức nổi bật của dữ liệu so với lịch sử và bối cảnh thị trường. Càng xa 0, tín hiệu càng mạnh."
      href={`/proposal/${data._id}/explanation/quant`}
      cta="Xem breakdown điểm tín hiệu"
    />
  );
}

function MetricCard({ title, value, level, body, href, cta }: {
  title: string;
  value: string;
  level: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-black text-white">{value}</p>
        <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">{level}</Badge>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">{body}</p>
      <Button asChild variant="outline" className="mt-4 border-white/10 text-slate-200">
        <Link href={href}>{cta}</Link>
      </Button>
    </section>
  );
}

function WhyScoreSection({ data, explanation }: { data: ProposalData; explanation?: ScoreExplanationData }) {
  const points = buildScoreExplanation(data, explanation);

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-cyan-300" />
      <h2 className="text-lg font-bold text-white">Vì sao điểm tín hiệu cao/thấp?</h2>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-slate-300">
        {points.map((point) => (
          <li key={point} className="rounded-lg border border-white/5 bg-black/30 px-3 py-2">{point}</li>
        ))}
      </ul>
    </section>
  );
}

function KeyInformation({ data, dataStatus }: { data: ProposalData; dataStatus: string[] }) {
  const roi = normalizePercentValue(data.pnlPercentage ?? data.financialImpact?.roi);
  const currentPrice = data.financialImpact?.currentPrice ?? data.financialImpact?.currentValue;
  const targetValue = data.financialImpact?.targetPrice ?? data.financialImpact?.projectedValue;

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <h2 className="text-lg font-bold text-white">Thông tin chính</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Mini label="Giá hiện tại" value={formatCurrency(currentPrice)} />
        <Mini label="Mục tiêu dự kiến" value={formatCurrency(targetValue)} />
        <Mini label="Kết quả kiểm chứng" value={data.roiStatus === 'NOT_AVAILABLE' || roi === null ? 'Đang chờ kiểm chứng sau 24h' : formatPercent(roi)} />
        <Mini label="Rủi ro" value={toDisplayRisk(data.financialImpact?.riskLevel)} />
        <Mini label="Chất lượng dữ liệu" value={dataStatus.join(' · ')} />
        <Mini label="Thời hạn" value={formatVietnameseDateTime(data.expiresAt)} />
      </div>
    </section>
  );
}

function DataSources({ data }: { data: ProposalData }) {
  const sources = normalizeSources(data.sources);

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <h2 className="text-lg font-bold text-white">Nguồn dữ liệu</h2>
      <div className="mt-4 space-y-3">
        {sources.length ? sources.map((source, index) => (
          <div key={`${source.url}-${index}`} className="rounded-lg border border-white/5 bg-black/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-white">{source.name}</p>
              <Badge variant="outline" className="border-white/10 text-slate-300">{source.type}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span>{source.timestamp}</span>
              <span>{source.weight}</span>
              <span>{source.contribution}</span>
            </div>
            {source.url ? (
              <Link href={source.url} target="_blank" className="mt-2 block truncate text-sm text-cyan-300 hover:text-cyan-200">
                {formatSourceUrl(source.url)}
              </Link>
            ) : null}
          </div>
        )) : (
          <p className="rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
            Chưa có nguồn dữ liệu gắn với khuyến nghị này.
          </p>
        )}
      </div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-300">
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-green-500" /> Mua</span>
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-red-500" /> Bán</span>
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Giữ</span>
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full border-2 border-green-500" /> Win</span>
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full border-2 border-red-500" /> Loss</span>
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full border-2 border-amber-500" /> Hòa vốn</span>
    </div>
  );
}

function PortfolioImpactBadge({ impact }: { impact: PortfolioImpact }) {
  const className = impact === 'DIRECT'
    ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
    : impact === 'INDIRECT'
      ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
      : impact === 'OUTSIDE'
        ? 'border-slate-500/30 bg-slate-500/10 text-slate-300'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-300';

  return <Badge className={className} variant="outline">{getPortfolioImpactLabel(impact)}</Badge>;
}

function StatusBadge({ status }: { status: RecommendationStatus }) {
  const className = status === 'EXPIRING_SOON' || status === 'MISSING_DATA'
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    : status === 'EXPIRED'
      ? 'border-slate-500/30 bg-slate-500/10 text-slate-300'
      : 'border-green-500/30 bg-green-500/10 text-green-300';

  return <Badge className={className} variant="outline">{getRecommendationStatusLabel(status)}</Badge>;
}

function getSystemBadge(data?: { activeConfig?: { status?: string; metrics?: Record<string, unknown> } | null; latestBacktestRun?: { status?: string; metrics?: Record<string, unknown> } | null }) {
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

function getDataStatus(data: ProposalData, timelineMissing: string[] = []) {
  const missing = new Set<string>();
  if (!data.sources?.length) missing.add('Chưa có nguồn liên kết');
  if (!data.financialImpact?.currentPrice && !data.financialImpact?.currentValue) missing.add('Giá tham chiếu chưa sẵn sàng');
  if (timelineMissing.includes('priceHistory')) missing.add('Thiếu lịch sử giá');
  if (!missing.size) return ['Dữ liệu đủ để đọc nhanh'];
  return Array.from(missing);
}

function getProposalObservedAt(data: ProposalData) {
  return data.backtestMeta?.detectedAt ?? data.createdAt;
}

function confidenceLevel(value?: number | null) {
  if (value === null || value === undefined) return 'Chưa có dữ liệu';
  if (value >= 75) return 'Mạnh';
  if (value >= 55) return 'Khá mạnh';
  if (value >= 35) return 'Hạn chế';
  return 'Yếu hoặc bị cap';
}

function buildScoreExplanation(data: ProposalData, explanation?: ScoreExplanationData) {
  if (explanation) {
    const factors = [...explanation.positiveFactors, ...explanation.negativeFactors];
    if (factors.length) return factors.slice(0, 5);
  }

  const finalScore = data.quantScore ?? data.scoreComponents?.finalScore ?? null;
  const points: string[] = [];

  if (finalScore !== null && finalScore !== undefined) {
    points.push(`Điểm tín hiệu ${formatNumber(finalScore, 2)} ${Math.abs(finalScore) > 1 ? 'đủ nổi bật để hỗ trợ luận điểm' : 'chưa thật sự nổi bật so với ngưỡng theo dõi'}.`);
  } else {
    points.push('Chưa có điểm tín hiệu nên chưa thể giải thích đầy đủ độ mạnh của luận điểm.');
  }

  if (data.signalMode === 'COLD_START') {
    points.push('Token còn ít lịch sử, nên độ tin cậy bị giới hạn thận trọng hơn.');
    points.push('Hệ thống tránh BUY/SELL quá mạnh khi thiếu dữ liệu lịch sử.');
  } else if (data.signalMode === 'NORMALIZED_ALPHA') {
    points.push('Token có đủ lịch sử hơn để so sánh với mẫu quá khứ và tương quan thị trường.');
    points.push('Độ tin cậy vẫn được giới hạn để tránh đọc khuyến nghị như một cam kết chắc thắng.');
  } else {
    points.push('Chưa đủ dữ liệu để xác định bối cảnh tính điểm.');
  }

  if (!data.pnlPercentage && data.pnlPercentage !== 0) points.push('Chưa có kết quả kiểm chứng, nên chưa dùng PnL làm bằng chứng lịch sử.');
  if (!data.sources?.length) points.push('Thiếu nguồn liên kết, độ tin cậy dữ liệu cần được xem là hạn chế.');
  return points;
}

function normalizeSources(sources: ProposalData['sources']) {
  return (sources ?? []).map((source) => {
    if (typeof source === 'string') {
      return {
        name: source,
        url: '',
        type: inferSourceType(source),
        timestamp: 'Chưa có thời điểm nguồn',
        weight: 'Chưa có trọng số nguồn',
        contribution: 'Nguồn tham khảo',
      };
    }

    const name = source.label ?? source.name ?? source.url ?? 'Source';
    return {
      name,
      url: source.url ?? '',
      type: inferSourceType(`${name} ${source.url ?? ''}`),
      timestamp: 'Thời điểm nguồn nếu có',
      weight: 'weight' in source && source.weight !== undefined ? `Trọng số: ${source.weight}` : 'Chưa có trọng số nguồn',
      contribution: 'weight' in source && source.weight !== undefined ? 'Có đóng góp vào điểm tín hiệu' : 'Nguồn tham khảo',
    };
  });
}

function inferSourceType(value: string) {
  const text = value.toLowerCase();
  if (text.includes('twitter') || text.includes('x.com') || text.includes('tweet')) return 'tweet';
  if (text.includes('price') || text.includes('coingecko')) return 'price';
  if (text.includes('social')) return 'social';
  return 'news';
}

function formatSourceUrl(value: string) {
  try {
    const url = new URL(value);
    const path = url.pathname === '/' ? '' : url.pathname;
    return `${url.hostname}${path}`.slice(0, 64);
  } catch {
    return value.length > 64 ? `${value.slice(0, 61)}...` : value;
  }
}

function actionTone(action?: string | null) {
  const value = String(action ?? '').toUpperCase();
  if (value === 'BUY') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (value === 'SELL') return 'border-red-500/30 bg-red-500/10 text-red-300';
  return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
}
