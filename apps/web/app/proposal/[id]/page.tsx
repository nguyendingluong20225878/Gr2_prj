'use client';

import Link from 'next/link';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { CountdownBadge, DataSkeleton, EmptyState } from '@/app/components/shared/NdlUi';
import ProposalAccuracyChart from './ProposalAccuracyChart';
import {
  useProposalDetail,
  useProposalScoreExplanation,
  useProposalTimeline,
  type ProposalData,
  type ScoreExplanationData,
} from '@/lib/hooks/useNdlData';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  normalizePercentValue,
  toDisplayAction,
  toDisplayRisk,
} from '@/lib/utils/formatters';
import { formatVietnameseDateTime } from '@/lib/utils/time';

export default function ProposalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const proposal = useProposalDetail(id);
  const timeline = useProposalTimeline(id);
  const scoreExplanation = useProposalScoreExplanation(id);
  const data = proposal.data;
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [showFullRationale, setShowFullRationale] = useState(false);

  const dataStatus = useMemo(() => data ? getDataStatus(data, timeline.data?.missingData) : [], [data, timeline.data]);

  const submitDecision = async (decision: 'WAIT' | 'REJECT') => {
    if (!data) return;
    setSubmitting(decision);
    try {
      const response = await fetch(`/api/proposals/${data._id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: decision === 'WAIT' ? 'Theo dõi đề xuất, chờ vùng giá phù hợp' : 'Từ chối đề xuất từ màn chi tiết',
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
      toast.success(decision === 'WAIT' ? 'Đã đưa vào theo dõi.' : 'Đã từ chối đề xuất.');
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
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Button>

        {proposal.isLoading ? (
          <DataSkeleton rows={4} />
        ) : !data ? (
          <EmptyState title="Không tìm thấy đề xuất" />
        ) : (
          <>
            <DecisionHeader
              data={data}
              dataStatus={dataStatus}
              submitting={submitting}
              onWait={() => submitDecision('WAIT')}
              onReject={() => submitDecision('REJECT')}
            />

            <RationaleSection
              data={data}
              expanded={showFullRationale}
              onToggle={() => setShowFullRationale((value) => !value)}
            />

            <section className="grid gap-4 lg:grid-cols-2">
              <ConfidenceCard data={data} />
              <QuantCard data={data} />
            </section>

            <WhyScoreSection data={data} explanation={scoreExplanation.data} />

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Trust history</p>
                  <h2 className="mt-1 text-lg font-bold text-white">Price history & proposal accuracy</h2>
                </div>
                <Legend />
              </div>
              {timeline.isLoading ? (
                <DataSkeleton rows={3} />
              ) : timeline.data ? (
                <ProposalAccuracyChart timeline={timeline.data} />
              ) : (
                <EmptyState title="Chưa tải được timeline" description="Backend timeline API chưa trả dữ liệu cho đề xuất này." />
              )}
            </section>

            <KeyInformation data={data} dataStatus={dataStatus} />
            <DataSources data={data} />
          </>
        )}
      </div>
    </Layout>
  );
}

function DecisionHeader({
  data,
  dataStatus,
  submitting,
  onWait,
  onReject,
}: {
  data: ProposalData;
  dataStatus: string[];
  submitting: string | null;
  onWait: () => void;
  onReject: () => void;
}) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Decision proposal</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black text-white">{data.tokenSymbol ?? data.tokenName ?? 'TOKEN'}</h1>
            <Badge className={actionTone(data.action ?? data.suggestionType)} variant="outline">
              {toDisplayAction(data.action ?? data.suggestionType)}
            </Badge>
            <CountdownBadge value={data.expiresAt} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {dataStatus.map((status) => (
              <Badge key={status} variant="outline" className="border-white/10 bg-white/5 text-slate-300">
                {status}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onWait} disabled={Boolean(submitting)} variant="outline" className="border-cyan-500/30 text-cyan-300">
            {submitting === 'WAIT' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Follow
          </Button>
          <Button asChild variant="outline" className="border-amber-500/30 text-amber-300">
            <Link href={`/proposal/${data._id}/scenario`}><Clock className="h-4 w-4" /> Wait for price zone</Link>
          </Button>
          <Button onClick={onReject} disabled={Boolean(submitting)} variant="outline" className="border-red-500/30 text-red-300">
            {submitting === 'REJECT' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Reject
          </Button>
          <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
            <Link href={`/proposal/${data._id}/trade`}>Execute trade</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function RationaleSection({ data, expanded, onToggle }: { data: ProposalData; expanded: boolean; onToggle: () => void }) {
  const rationale = data.summary ?? data.rationaleSummary ?? 'Chưa có rationale cho đề xuất này.';
  const bullets = (data.reason ?? [])
    .map((reason) => reason.trim())
    .filter((reason) => reason.length > 0 && reason !== rationale);

  return (
    <section className="glass-card rounded-xl border border-cyan-500/15 bg-cyan-950/10 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Rationale</p>
      <h2 className="mt-1 text-xl font-bold text-white">Vì sao đề xuất này tồn tại?</h2>
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
      title="Confidence"
      value={data.confidence === null || data.confidence === undefined ? 'N/A' : `${data.confidence}%`}
      level={level}
      body={
        isColdStart
          ? 'Không phải xác suất có lời. Đây là độ mạnh tín hiệu sau giới hạn cold-start, cap tối đa 40% vì thiếu lịch sử.'
          : 'Không phải xác suất có lời. Đây là độ mạnh tín hiệu sau khi áp dụng cap 95% và penalty theo sample size nếu dữ liệu ít.'
      }
      href={`/proposal/${data._id}/explanation`}
      cta="View calculation"
    />
  );
}

function QuantCard({ data }: { data: ProposalData }) {
  const quant = data.quantScore ?? data.scoreComponents?.finalScore ?? null;
  const direction = quant === null ? 'Chưa đủ dữ liệu' : quant > 0 ? 'Positive alpha / BUY bias' : quant < 0 ? 'Negative alpha / SELL bias' : 'Neutral';

  return (
    <MetricCard
      title="Quant (Final Score)"
      value={formatNumber(quant, 2)}
      level={direction}
      body="Quant đo mức bất thường của tín hiệu so với mẫu lịch sử và tương quan thị trường. Càng xa 0, tín hiệu càng mạnh; dương nghiêng BUY, âm nghiêng SELL."
      href={`/proposal/${data._id}/explanation`}
      cta="View breakdown"
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
        <h2 className="text-lg font-bold text-white">Why is this score high/low?</h2>
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
      <h2 className="text-lg font-bold text-white">Key information</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Mini label="Current price" value={formatCurrency(currentPrice)} />
        <Mini label="Target / projected value" value={formatCurrency(targetValue)} />
        <Mini label="ROI / backtest result" value={data.roiStatus === 'NOT_AVAILABLE' || roi === null ? 'Chưa backtest' : formatPercent(roi)} />
        <Mini label="Risk level" value={toDisplayRisk(data.financialImpact?.riskLevel)} />
        <Mini label="Data quality" value={dataStatus.join(' · ')} />
        <Mini label="Expiration" value={formatVietnameseDateTime(data.expiresAt)} />
      </div>
    </section>
  );
}

function DataSources({ data }: { data: ProposalData }) {
  const sources = normalizeSources(data.sources);

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <h2 className="text-lg font-bold text-white">Data sources</h2>
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
                {source.url}
              </Link>
            ) : null}
          </div>
        )) : (
          <p className="rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
            Chưa có nguồn dữ liệu gắn với đề xuất này.
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
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-green-500" /> BUY</span>
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-red-500" /> SELL</span>
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-purple-500" /> HOLD</span>
    </div>
  );
}

function getDataStatus(data: ProposalData, timelineMissing: string[] = []) {
  const missing = new Set<string>();
  if (!data.pnlPercentage && data.pnlPercentage !== 0) missing.add('Missing backtest');
  if (!data.sources?.length) missing.add('Missing sources');
  if (!data.financialImpact?.currentPrice && !data.financialImpact?.currentValue) missing.add('Missing price');
  if (timelineMissing.includes('priceHistory')) missing.add('Missing price history');
  if (!missing.size) return ['Full data'];
  return Array.from(missing);
}

function confidenceLevel(value?: number | null) {
  if (value === null || value === undefined) return 'Unknown';
  if (value >= 75) return 'Strong';
  if (value >= 55) return 'Moderately strong';
  if (value >= 35) return 'Limited';
  return 'Weak / capped';
}

function buildScoreExplanation(data: ProposalData, explanation?: ScoreExplanationData) {
  if (explanation) {
    const factors = [...explanation.positiveFactors, ...explanation.negativeFactors];
    if (factors.length) return factors.slice(0, 5);
  }

  const finalScore = data.quantScore ?? data.scoreComponents?.finalScore ?? null;
  const points: string[] = [];

  if (finalScore !== null && finalScore !== undefined) {
    points.push(`finalScore = ${formatNumber(finalScore, 2)} ${Math.abs(finalScore) > 1 ? 'vượt ngưỡng tín hiệu' : 'chưa cách xa 0 nhiều'}.`);
  } else {
    points.push('Chưa có finalScore nên hệ thống không thể giải thích độ mạnh định lượng đầy đủ.');
  }

  if (data.signalMode === 'COLD_START') {
    points.push('Token đang ở COLD_START: lịch sử hạn chế, confidence bị cap tối đa 40%.');
    points.push('Hệ thống tránh BUY/SELL quá mạnh khi thiếu dữ liệu lịch sử.');
  } else if (data.signalMode === 'NORMALIZED_ALPHA') {
    points.push('Token ở NORMALIZED_ALPHA: có đủ lịch sử để so sánh với mẫu quá khứ và tương quan thị trường.');
    points.push('Confidence được cap 95% để tránh overconfidence, sau đó có thể bị giảm bởi sample size penalty.');
  } else {
    points.push('Chưa có signal mode nên cần xem trang giải thích để kiểm tra dữ liệu tính điểm.');
  }

  if (!data.pnlPercentage && data.pnlPercentage !== 0) points.push('Chưa có backtest, nên chưa dùng PnL làm bằng chứng lịch sử.');
  if (!data.sources?.length) points.push('Thiếu sources, độ tin cậy dữ liệu cần được xem là hạn chế.');
  return points;
}

function normalizeSources(sources: ProposalData['sources']) {
  return (sources ?? []).map((source) => {
    if (typeof source === 'string') {
      return {
        name: source,
        url: '',
        type: inferSourceType(source),
        timestamp: 'Timestamp chưa có',
        weight: 'Weight chưa có',
        contribution: 'Reference source',
      };
    }

    const name = source.label ?? source.name ?? source.url ?? 'Source';
    return {
      name,
      url: source.url ?? '',
      type: inferSourceType(`${name} ${source.url ?? ''}`),
      timestamp: 'Timestamp lấy từ pipeline nguồn nếu có',
      weight: 'weight' in source && source.weight !== undefined ? `Weight: ${source.weight}` : 'Weight chưa có',
      contribution: 'weight' in source && source.weight !== undefined ? 'Contributed to score' : 'Reference source',
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

function actionTone(action?: string | null) {
  const value = String(action ?? '').toUpperCase();
  if (value === 'BUY') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (value === 'SELL') return 'border-red-500/30 bg-red-500/10 text-red-300';
  return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
}
