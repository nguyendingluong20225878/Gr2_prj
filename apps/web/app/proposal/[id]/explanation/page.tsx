'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ChevronDown, Info, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { ProposalFlowNav } from '@/app/components/proposal/ProposalFlowNav';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { DataSkeleton, EmptyState } from '@/app/components/shared/NdlUi';
import { useProposalDetail, useProposalScoreExplanation } from '@/lib/hooks/useNdlData';
import type { ProposalData, ScoreExplanationData } from '@/lib/hooks/useNdlData';
import { formatConfidence, formatNumber } from '@/lib/utils/formatters';
import { deriveBacktestSemantics } from '@/lib/utils/semantics';

type Tone = 'cyan' | 'green' | 'amber' | 'red' | 'slate';
type ChecklistStatus = 'OK' | 'LIMITED' | 'MISSING';
type ChecklistItem = { label: string; status: ChecklistStatus; detail: string };
type CautionItem = { label: string; detail: string };

const SCORE_COMPONENT_TITLES: Record<string, string> = {
  finalScore: 'Điểm tổng hợp',
  pureAlphaZ: 'Bất thường theo lịch sử token',
  crossZ: 'Nổi bật so với thị trường',
  timeZ: 'Bất thường theo thời gian',
  unifiedRaw: 'Điểm thô trước chuẩn hóa',
};

const FALLBACK_COMPONENT_DESCRIPTIONS: Record<string, string> = {
  finalScore: 'Điểm tổng hợp cuối cùng dùng để xét tín hiệu mạnh/yếu.',
  pureAlphaZ: 'Mức bất thường của token so với chính lịch sử của nó.',
  crossZ: 'Mức nổi bật của token so với nhóm thị trường cùng thời điểm.',
  timeZ: 'Tín hiệu bất thường theo thời gian.',
  unifiedRaw: 'Điểm thô trước chuẩn hóa/ngưỡng hóa.',
};

const TECHNICAL_LABELS: Record<string, string> = {
  'proposal.sources': 'nguồn dữ liệu của khuyến nghị',
  'signal.sources': 'nguồn dữ liệu của signal',
  'signalContext.sources': 'nguồn dữ liệu của signal',
  'metadata.sampleSize': 'số tín hiệu tham chiếu',
  'scoreComponents.sampleSize': 'số tín hiệu tham chiếu',
  'proposal.pnlPercentage': 'kết quả PnL của khuyến nghị',
  'financialImpact.currentPrice': 'giá hiện tại',
  'financialImpact.currentValue': 'giá trị hiện tại',
  COLD_START: 'dữ liệu lịch sử còn ít',
  NORMALIZED_ALPHA: 'có dữ liệu lịch sử để so sánh',
  'Sample size': 'Số tín hiệu tham chiếu',
  'sample size': 'số tín hiệu tham chiếu',
  'Score components': 'Thành phần điểm',
  'score components': 'thành phần điểm',
  'Backtest/PnL': 'Kết quả kiểm chứng',
  'Price/current value': 'Giá hiện tại',
  'Confidence': 'Độ tin cậy',
  'confidence': 'độ tin cậy',
  'confidence cap': 'giới hạn độ tin cậy',
  'confidence bị cap': 'độ tin cậy bị giới hạn',
  'confidence bị penalty': 'độ tin cậy bị giảm',
  'penalty': 'hệ số giảm',
  'cap': 'giới hạn',
  sources: 'nguồn dữ liệu',
  finalScore: 'điểm tổng hợp',
  sampleSize: 'số tín hiệu tham chiếu',
  backtest: 'kết quả kiểm chứng/PnL',
  price: 'giá hiện tại',
  scoreComponents: 'thành phần điểm',
  missingData: 'dữ liệu còn thiếu',
  currentPrice: 'giá hiện tại',
  currentValue: 'giá trị hiện tại',
};

export default function ProposalExplanationPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const proposal = useProposalDetail(id);
  const explanation = useProposalScoreExplanation(id);
  const data = explanation.data;
  const proposalData = proposal.data;

  if (explanation.isLoading || proposal.isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <BackButton onBack={() => router.back()} />
          <ProposalFlowNav proposalId={id} activeStep="explanation" />
          <DataSkeleton rows={5} />
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="space-y-6">
          <BackButton onBack={() => router.back()} />
          <ProposalFlowNav proposalId={id} activeStep="explanation" />
          <EmptyState title="Không có dữ liệu giải thích điểm" />
        </div>
      </Layout>
    );
  }

  const tokenName = proposalData?.tokenSymbol ?? proposalData?.tokenName ?? 'Token chưa định danh';
  const confidenceValue = data.confidence ?? proposalData?.confidence;
  const quantValue = data.finalScore ?? proposalData?.quantScore;
  const sourceItems = normalizeSources(proposalData);
  const referenceCountLabel = data.sampleSize === null || data.sampleSize === undefined ? 'Chưa có dữ liệu tham chiếu' : `${formatNumber(data.sampleSize, 0)} tín hiệu tham chiếu`;
  const backtest = proposalData ? deriveBacktestSemantics({
    actualPnL: proposalData.actualPnL ?? undefined,
    backtestMeta: proposalData.backtestMeta ? {
      dataQuality: proposalData.backtestMeta.dataQuality,
      feeRate: proposalData.backtestMeta.feeRate ?? undefined,
      grossPnlPercentage: proposalData.backtestMeta.grossPnlPercentage ?? undefined,
      slippageRate: proposalData.backtestMeta.slippageRate ?? undefined,
    } : undefined,
    pnlPercentage: proposalData.pnlPercentage ?? undefined,
    winLossStatus: proposalData.winLossStatus ?? undefined,
  }) : null;
  const hasBacktest = Boolean(backtest && backtest.outcome !== 'NOT_TESTED');
  const signalMode = data.signalMode ?? proposalData?.signalMode ?? 'Chưa có dữ liệu';
  const signalModeLabel = displaySignalMode(signalMode);
  const missingData = data.missingData ?? [];
  const missingDataLabels = missingData.map(readableTechnicalLabel);
  const dataSourceItems = data.dataSources?.length ? data.dataSources : fallbackDataSources(sourceItems, data, hasBacktest);
  const trustItems = data.trustChecklist?.length ? data.trustChecklist : fallbackTrustChecklist(sourceItems, data, signalMode, hasBacktest, missingData);
  const cautionItems = data.cautionChecklist?.length ? data.cautionChecklist : fallbackCautionChecklist(data, signalMode, hasBacktest, missingData);
  const summaryTrustItems = trustItems.slice(0, 3).map((item) => `${userFacingDetail(item.label)} (${statusLabel(item.status)})`);
  const summaryCautionItems = cautionItems.slice(0, 3).map((item) => userFacingDetail(item.label));

  return (
    <Layout>
      <div className="space-y-6">
        <BackButton onBack={() => router.back()} />
        <ProposalFlowNav proposalId={id} activeStep="explanation" />

        <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Giải thích độ tin cậy</p>
          <h1 className="mt-2 text-3xl font-black text-white">Giải thích khuyến nghị</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
            Tóm tắt dữ liệu đầu vào, điểm tín hiệu và công thức chính. Các phần mở rộng chỉ giữ lại thông tin cần thiết để kiểm tra quyết định.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">{tokenName}</Badge>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300">{signalModeLabel}</Badge>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300">{referenceCountLabel}</Badge>
          </div>
        </section>

        <QuickExplanationSummary
          confidence={formatConfidence(confidenceValue)}
          quantScore={formatNumber(quantValue, 2)}
          signalMode={signalModeLabel}
          trustItems={summaryTrustItems}
          cautionItems={summaryCautionItems}
        />

        <TechnicalPanel title="Dữ liệu đầu vào">
          <div className="grid gap-3 lg:grid-cols-2">
            <MetricCard
              label="Dữ liệu tham chiếu"
              value={referenceCountLabel}
              source="Lấy từ đâu: số quan sát dùng để đánh giá khuyến nghị."
              detail="Nếu số tín hiệu tham chiếu còn ít, độ tin cậy sẽ bị giảm để tránh đọc kết luận quá chắc."
              tone={data.sampleSize === null || data.sampleSize === undefined ? 'amber' : 'slate'}
            />
            <MetricCard
              label="Thời điểm tín hiệu"
              value={formatDate(proposalData?.signalContext?.detectedAt ?? proposalData?.backtestMeta?.detectedAt ?? proposalData?.createdAt)}
              source="Lấy từ đâu: thời điểm phát hiện dữ liệu, thời điểm kiểm chứng hoặc thời điểm tạo khuyến nghị."
              detail="Thời điểm giúp biết tín hiệu được ghi nhận ở bối cảnh market nào."
              tone="slate"
            />
          </div>
        </TechnicalPanel>

        <TechnicalPanel title="Công thức dễ đọc">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Formula
                label="Điểm tín hiệu"
                value={buildScoreFormula(data)}
              />
              <Formula
                label="Độ tin cậy"
                value={buildConfidenceFormula(data)}
              />
            </div>
            <div className="grid gap-3">
              <Mini label="Kết quả định lượng" value={formatNumber(data.finalScore, 2)} />
              <Mini label="Mốc quyết định hành động" value={formatNumber(data.thresholds.actionThreshold, 2)} />
              <Mini label="Mốc phát hiện tín hiệu" value={formatNumber(data.thresholds.signalThreshold, 2)} />
              <Mini label="Bối cảnh dữ liệu" value={signalModeLabel} />
            </div>
          </div>
        </TechnicalPanel>

        <div className="flex justify-end">
          <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
            <Link href={`/proposal/${id}`}>Quay lại khuyến nghị</Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" onClick={onBack} className="pl-0 text-slate-400 hover:text-white">
      <ArrowLeft className="h-4 w-4" /> Quay lại khuyến nghị
    </Button>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-xs font-black text-cyan-200">{eyebrow}</span>
        <h2 className="text-lg font-bold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function QuickExplanationSummary({
  cautionItems,
  confidence,
  quantScore,
  signalMode,
  trustItems,
}: {
  confidence: string;
  quantScore: string;
  signalMode: string;
  trustItems: string[];
  cautionItems: string[];
}) {
  return (
    <section className="glass-card rounded-xl border border-cyan-500/15 bg-cyan-500/10 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Kết luận nhanh</p>
          <h2 className="mt-1 text-xl font-bold text-white">Đọc nhanh trước khi xem kỹ thuật</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-100/80">
            Độ tin cậy là mức dữ liệu ủng hộ luận điểm, không phải xác suất chắc chắn có lời.
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-3 gap-2 lg:min-w-[360px]">
          <Mini label="Tin cậy" value={confidence} />
          <Mini label="Điểm" value={quantScore} />
          <Mini label="Bối cảnh" value={signalMode} />
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <CompactList title="Điểm đáng tin" items={trustItems} empty="Chưa có điểm đáng tin rõ ràng." tone="green" />
        <CompactList title="Điểm cần thận trọng" items={cautionItems} empty="Chưa có điểm cần thận trọng rõ ràng." tone="amber" />
      </div>
    </section>
  );
}

function CompactList({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: 'green' | 'amber' }) {
  const dot = tone === 'green' ? 'bg-green-300' : 'bg-amber-300';
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-3">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <p key={item} className="flex gap-2 text-sm text-slate-300">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span className="line-clamp-2">{item}</span>
          </p>
        )) : (
          <p className="text-sm text-slate-500">{empty}</p>
        )}
      </div>
    </div>
  );
}

function TechnicalPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="glass-card group rounded-xl border border-white/5 bg-black/20 p-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-white marker:hidden">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Mở rộng</p>
          <h2 className="mt-1 text-lg font-bold">{title}</h2>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-cyan-200 transition-transform group-open:rotate-180">
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </span>
      </summary>
      <div className="border-t border-white/5 p-5 pt-4">
        {children}
      </div>
    </details>
  );
}

function MetricCard({ label, value, source, detail, tone }: { label: string; value: ReactNode; source: string; detail: string; tone: Tone }) {
  const Icon = tone === 'green' ? CheckCircle2 : tone === 'amber' || tone === 'red' ? TriangleAlert : tone === 'cyan' ? ShieldCheck : Info;
  return (
    <div className={`rounded-lg border p-4 ${toneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-current" />
      </div>
      <p className="mt-3 text-xs font-semibold text-cyan-100">{source}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    </div>
  );
}

function Formula({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <code className="mt-2 block whitespace-pre-wrap text-sm text-cyan-200">{value}</code>
    </div>
  );
}

function buildScoreFormula(data: ScoreExplanationData) {
  const components = data.scoreComponents ?? {};
  const alphaBlend = data.thresholds.alphaBlend ?? data.alphaBlendDefault ?? 0.7;
  const pureAlphaZ = Number(components.pureAlphaZ);
  const crossZ = Number(components.crossZ);
  const finalScoreRaw = Number(data.finalScore ?? components.finalScore);
  const actionThreshold = Number(data.thresholds.actionThreshold);
  const mode = data.quantFormulaMode ?? 'ALPHA_BLEND';
  const hasActionThreshold = Number.isFinite(actionThreshold);
  const actionDistance = hasActionThreshold && Number.isFinite(finalScoreRaw)
    ? Math.abs(finalScoreRaw) - actionThreshold
    : null;
  const decisionText = actionDistance === null
    ? 'Chưa đủ dữ liệu để so với mốc quyết định hành động.'
    : actionDistance >= 0
      ? `Điểm này đã vượt mốc quyết định hành động ${formatNumber(actionThreshold, 2)}.`
      : `Điểm này còn thấp hơn mốc quyết định hành động ${formatNumber(actionThreshold, 2)}, nên nên đọc thận trọng.`;

  if (mode === 'PURE_ALPHA_FALLBACK') {
    return [
      `Điểm tín hiệu hiện tại là ${numberFormulaValue(finalScoreRaw)}.`,
      'Vì dữ liệu lịch sử còn ít hoặc thiếu dữ liệu so sánh thị trường, hệ thống dùng điểm bất thường của chính token làm điểm chính.',
      decisionText,
    ].join('\n');
  }

  return [
    `Điểm tín hiệu hiện tại là ${numberFormulaValue(finalScoreRaw)}.`,
    `Điểm này được ghép từ ${formatNumber(Number(alphaBlend) * 100, 0)}% độ bất thường của token (${numberFormulaValue(pureAlphaZ)}) và ${formatNumber((1 - Number(alphaBlend)) * 100, 0)}% mức nổi bật so với thị trường (${numberFormulaValue(crossZ)}).`,
    decisionText,
  ].join('\n');
}

function buildConfidenceFormula(data: ScoreExplanationData) {
  const divisor = data.signalMode === 'COLD_START'
    ? data.thresholds.coldStartConfidenceDivisor ?? data.thresholds.confidenceDivisor
    : data.thresholds.confidenceDivisor;
  const confidenceCap = data.confidenceCap ?? 1;
  const samplePenalty = data.sampleSizePenalty ?? 1;
  const finalScore = Math.abs(Number(data.finalScore ?? data.scoreComponents?.finalScore ?? 0));
  const baseConfidence = divisor ? Math.min(finalScore / Number(divisor), 1) : null;
  const confidencePercent = formatConfidence(data.confidence);

  return [
    `Độ tin cậy hiện tại là ${confidencePercent}.`,
    `Hệ thống bắt đầu từ độ mạnh của điểm tín hiệu (${formatNumber(finalScore, 2)}) rồi giảm theo mức dữ liệu hiện có.`,
    `Giới hạn dữ liệu: ${formatPercentLike(confidenceCap)}. Hệ số dữ liệu tham chiếu: ${formatPercentLike(samplePenalty)}.`,
    baseConfidence === null
      ? 'Chưa đủ dữ liệu để tính phần nền của độ tin cậy.'
      : `Phần nền trước khi giảm là ${formatPercentLike(baseConfidence)}.`,
  ].join('\n');
}

function formatPercentLike(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'n/a';
  return `${formatNumber(numeric * 100, 0)}%`;
}

function numberFormulaValue(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatNumber(numeric, 4) : 'n/a';
}

function Mini({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function ListPanel({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: 'green' | 'amber' | 'cyan' }) {
  const bullet = tone === 'green' ? 'bg-green-400' : tone === 'amber' ? 'bg-amber-400' : 'bg-cyan-400';
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 p-4">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.length ? items.map((item) => (
          <p key={item} className="flex gap-2 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-sm text-slate-300">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${bullet}`} />
            {item}
          </p>
        )) : (
          <p className="rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">{empty}</p>
        )}
      </div>
    </div>
  );
}

function ChecklistPanel({ title, items, empty }: { title: string; items: ChecklistItem[]; empty: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 p-4">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.length ? items.map((item) => (
          <div key={`${item.label}-${item.status}`} className={`rounded-lg border px-3 py-2 ${statusCardClass(item.status)}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">{userFacingDetail(item.label)}</p>
              <Badge variant="outline" className={auditTone(item.status)}>{statusLabel(item.status)}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{userFacingDetail(item.detail)}</p>
          </div>
        )) : (
          <p className="rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">{empty}</p>
        )}
      </div>
    </div>
  );
}

function CautionPanel({ title, items, empty }: { title: string; items: CautionItem[]; empty: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 p-4">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.length ? items.map((item) => (
          <div key={item.label} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 shrink-0 text-amber-300" />
              <p className="text-sm font-semibold text-white">{userFacingDetail(item.label)}</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{userFacingDetail(item.detail)}</p>
          </div>
        )) : (
          <p className="rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">{empty}</p>
        )}
      </div>
    </div>
  );
}

function componentOrder(data: ScoreExplanationData) {
  const preferred = ['finalScore', 'pureAlphaZ', 'crossZ', 'timeZ', 'unifiedRaw'];
  const available = new Set(Object.keys(data.scoreComponents ?? {}));
  return preferred.filter((key) => key === 'finalScore' || available.has(key));
}

function componentHasValue(key: string, data: ScoreExplanationData) {
  const value = key === 'finalScore' ? data.scoreComponents?.[key] ?? data.finalScore : data.scoreComponents?.[key];
  return value !== null && value !== undefined;
}

function componentAvailabilityLabel(key: string, data: ScoreExplanationData) {
  return componentHasValue(key, data) ? 'Có dữ liệu' : 'Chưa có dữ liệu';
}

function formatComponentValue(value: unknown) {
  if (typeof value === 'number') return formatNumber(value, 4);
  if (value === null || value === undefined) return 'Chưa có dữ liệu thành phần này';
  return String(value);
}

function normalizeSources(proposal?: ProposalData) {
  const sources = proposal?.sources ?? proposal?.signalContext?.sources ?? [];
  return sources.map((source) => {
    if (typeof source === 'string') return source;
    if (source.label) return source.label;
    if ('name' in source && source.name) return source.name;
    if ('sourceKey' in source && source.sourceKey) return source.sourceKey;
    return source.url ?? 'Nguồn chưa định danh';
  });
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function toneClass(tone: Tone) {
  if (tone === 'green') return 'border-green-500/20 bg-green-500/10 text-green-300';
  if (tone === 'amber') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  if (tone === 'red') return 'border-red-500/20 bg-red-500/10 text-red-300';
  if (tone === 'cyan') return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300';
  return 'border-white/5 bg-black/40 text-slate-300';
}

function auditTone(status: string) {
  if (status === 'OK') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (status === 'LIMITED') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-red-500/30 bg-red-500/10 text-red-300';
}

function statusCardClass(status: ChecklistStatus) {
  if (status === 'OK') return 'border-green-500/20 bg-green-500/10';
  if (status === 'LIMITED') return 'border-amber-500/20 bg-amber-500/10';
  return 'border-red-500/20 bg-red-500/10';
}

function statusLabel(status: ChecklistStatus) {
  if (status === 'OK') return 'Đủ';
  if (status === 'LIMITED') return 'Hạn chế';
  return 'Thiếu';
}

function displaySignalMode(value?: string | null) {
  const mode = String(value ?? '').toUpperCase();
  if (!mode) return 'Chưa có dữ liệu';
  if (mode === 'COLD_START') return 'Dữ liệu lịch sử còn ít';
  if (mode === 'NORMALIZED_ALPHA') return 'Có lịch sử để so sánh';
  return 'Bối cảnh dữ liệu hiện có';
}

function readableTechnicalLabel(key: string) {
  return TECHNICAL_LABELS[key] ?? key;
}

function userFacingDetail(detail: string) {
  return Object.entries(TECHNICAL_LABELS).sort(([a], [b]) => b.length - a.length).reduce((text, [key, label]) => {
    return text.replace(new RegExp(`\\b${escapeRegExp(key)}\\b`, 'g'), label);
  }, detail);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fallbackDataSources(sourceItems: string[], data: ScoreExplanationData, hasBacktest: boolean): ChecklistItem[] {
  const sampleMissing = data.sampleSize === null || data.sampleSize === undefined;
  return [
    {
      label: 'Nguồn dữ liệu',
      status: sourceItems.length ? 'OK' : 'MISSING',
      detail: sourceItems.length
        ? 'Có nguồn dữ liệu hỗ trợ khuyến nghị.'
        : 'Chưa có nguồn dữ liệu được gắn với khuyến nghị.',
    },
    {
      label: 'Dữ liệu tham chiếu',
      status: sampleMissing ? 'MISSING' : data.sampleSizePenalty !== null && data.sampleSizePenalty !== undefined && data.sampleSizePenalty < 1 ? 'LIMITED' : 'OK',
      detail: sampleMissing
        ? 'Chưa đủ dữ liệu để đọc độ rộng dữ liệu tham chiếu.'
        : `Hiện có ${data.sampleSize} tín hiệu tham chiếu.`,
    },
    {
      label: 'Kết quả kiểm chứng',
      status: hasBacktest ? 'OK' : 'MISSING',
      detail: hasBacktest
        ? 'Khuyến nghị đã có kết quả kiểm chứng/PnL để tham chiếu.'
        : 'Chưa có kết quả kiểm chứng/PnL để dùng làm bằng chứng lịch sử.',
    },
  ];
}

function fallbackTrustChecklist(
  sourceItems: string[],
  data: ScoreExplanationData,
  signalMode: string,
  hasBacktest: boolean,
  missingData: string[],
): ChecklistItem[] {
  const sampleMissing = data.sampleSize === null || data.sampleSize === undefined;
  return [
    {
      label: 'Có nguồn dữ liệu',
      status: sourceItems.length ? 'OK' : 'MISSING',
      detail: sourceItems.length ? 'Có nguồn dữ liệu hỗ trợ khuyến nghị.' : 'Thiếu nguồn dữ liệu hỗ trợ khuyến nghị.',
    },
    {
      label: 'Dữ liệu tham chiếu đủ rộng',
      status: sampleMissing ? 'MISSING' : data.sampleSizePenalty !== null && data.sampleSizePenalty !== undefined && data.sampleSizePenalty < 1 ? 'LIMITED' : 'OK',
      detail: sampleMissing
        ? 'Thiếu số tín hiệu tham chiếu nên chưa đánh giá được độ rộng dữ liệu.'
        : data.sampleSizePenalty !== null && data.sampleSizePenalty !== undefined && data.sampleSizePenalty < 1
          ? `Số tín hiệu tham chiếu thấp nên độ tin cậy bị giảm còn ${data.sampleSizePenalty}.`
          : 'Số tín hiệu tham chiếu không làm giảm độ tin cậy theo dữ liệu hiện có.',
    },
    {
      label: 'Bối cảnh dữ liệu',
      status: String(signalMode).toUpperCase() === 'COLD_START' ? 'LIMITED' : 'OK',
      detail: String(signalMode).toUpperCase() === 'COLD_START'
        ? 'Token còn ít lịch sử, nên độ tin cậy bị giới hạn thấp hơn.'
        : 'Dữ liệu hiện có đủ hơn để so sánh với lịch sử trước đó.',
    },
    {
      label: 'Kết quả kiểm chứng',
      status: hasBacktest ? 'OK' : 'MISSING',
      detail: hasBacktest ? 'Có kết quả quá khứ để tham chiếu.' : 'Chưa có kết quả kiểm chứng/PnL.',
    },
    {
      label: 'Dữ liệu còn thiếu',
      status: missingData.length ? 'LIMITED' : 'OK',
      detail: missingData.length ? `Còn thiếu: ${missingData.map(readableTechnicalLabel).join(', ')}.` : 'Chưa ghi nhận dữ liệu thiếu.',
    },
  ];
}

function fallbackCautionChecklist(
  data: ScoreExplanationData,
  signalMode: string,
  hasBacktest: boolean,
  missingData: string[],
): CautionItem[] {
  const items: CautionItem[] = [
    {
      label: 'Độ tin cậy không phải xác suất lợi nhuận',
      detail: 'Độ tin cậy là độ mạnh của luận điểm sau các giới hạn thận trọng, không đảm bảo giao dịch có lời.',
    },
  ];

  if (String(signalMode).toUpperCase() === 'COLD_START') {
    items.push({
      label: 'Dữ liệu lịch sử còn ít',
      detail: 'Thiếu lịch sử so sánh; độ tin cậy bị giới hạn thấp hơn để tránh tin quá mức.',
    });
  }

  if (data.sampleSizePenalty !== null && data.sampleSizePenalty !== undefined && data.sampleSizePenalty < 1) {
    items.push({
      label: 'Ít tín hiệu tham chiếu',
      detail: `Số tín hiệu tham chiếu thấp nên độ tin cậy bị giảm còn ${data.sampleSizePenalty}.`,
    });
  }

  if (!hasBacktest) {
    items.push({
      label: 'Thiếu kết quả kiểm chứng/PnL',
      detail: 'Chưa có kết quả quá khứ nên không trình bày điểm như bằng chứng lợi nhuận.',
    });
  }

  if (missingData.length) {
    items.push({
      label: 'Thiếu dữ liệu',
      detail: `Dữ liệu còn thiếu: ${missingData.map(readableTechnicalLabel).join(', ')}.`,
    });
  }

  return items;
}
