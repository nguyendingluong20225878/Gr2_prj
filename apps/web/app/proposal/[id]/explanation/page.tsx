'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Info, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { DataSkeleton, EmptyState } from '@/app/components/shared/NdlUi';
import { useProposalDetail, useProposalScoreExplanation } from '@/lib/hooks/useNdlData';
import type { ProposalData, ScoreExplanationData } from '@/lib/hooks/useNdlData';
import { formatConfidence, formatNumber, formatPercent } from '@/lib/utils/formatters';
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
  'metadata.sampleSize': 'cỡ mẫu',
  'scoreComponents.sampleSize': 'cỡ mẫu',
  'proposal.pnlPercentage': 'kết quả PnL của khuyến nghị',
  'financialImpact.currentPrice': 'giá hiện tại',
  'financialImpact.currentValue': 'giá trị hiện tại',
  sources: 'nguồn dữ liệu',
  finalScore: 'điểm tổng hợp',
  sampleSize: 'cỡ mẫu',
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
          <EmptyState title="Không có dữ liệu giải thích điểm" />
        </div>
      </Layout>
    );
  }

  const tokenName = proposalData?.tokenSymbol ?? proposalData?.tokenName ?? 'Token chưa định danh';
  const confidenceValue = data.confidence ?? proposalData?.confidence;
  const quantValue = data.finalScore ?? proposalData?.quantScore;
  const sourceItems = normalizeSources(proposalData);
  const sampleSizeLabel = data.sampleSize === null || data.sampleSize === undefined ? 'Chưa có cỡ mẫu' : formatNumber(data.sampleSize, 0);
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

  return (
    <Layout>
      <div className="space-y-6">
        <BackButton onBack={() => router.back()} />

        <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Giải thích độ tin cậy</p>
          <h1 className="mt-2 text-3xl font-black text-white">Tại sao có thể tin số này?</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
            Màn Advanced này giải thích điểm tín hiệu hỗ trợ khuyến nghị ra sao, cách điểm được tính, và những giới hạn khiến độ tin cậy cần được hiểu thận trọng.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">{tokenName}</Badge>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300">{signalModeLabel}</Badge>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300">{sampleSizeLabel}</Badge>
          </div>
        </section>

        <Panel eyebrow="1" title="Kết luận nhanh">
          <div className="grid gap-3 lg:grid-cols-3">
            <MetricCard
              label="Tin cậy"
              value={formatConfidence(confidenceValue)}
              source="Lấy từ đâu: mức tin cậy cuối cùng đã được chuẩn hóa cho khuyến nghị."
              detail="Không phải xác suất chắc chắn có lời. Đây là mức tin cậy sau khi hệ thống cân nhắc bối cảnh dữ liệu, cỡ mẫu và các phần còn thiếu."
              tone="cyan"
            />
            <MetricCard
              label="Điểm tín hiệu"
              value={formatNumber(quantValue, 2)}
              source="Lấy từ đâu: điểm tín hiệu tổng hợp của khuyến nghị."
              detail="Điểm tín hiệu dùng để mô tả độ mạnh/yếu của luận điểm, không tự tạo quyết định giao dịch mới."
              tone="green"
            />
            <MetricCard
              label="Bối cảnh tín hiệu"
              value={signalModeLabel}
              source="Lấy từ đâu: bối cảnh dữ liệu hệ thống dùng khi đọc khuyến nghị."
              detail={String(signalMode).toUpperCase() === 'COLD_START'
                ? 'Token còn ít lịch sử, nên độ tin cậy bị giới hạn chặt hơn.'
                : 'Bối cảnh này cho biết hệ thống đang đọc điểm dựa trên dữ liệu hiện có.'}
              tone={String(signalMode).toUpperCase() === 'COLD_START' ? 'amber' : 'slate'}
            />
          </div>
        </Panel>

        <Panel eyebrow="2" title="Dữ liệu đầu vào">
          <div className="grid gap-3 lg:grid-cols-2">
            <MetricCard
              label="Cỡ mẫu"
              value={sampleSizeLabel}
              source="Lấy từ đâu: số quan sát dùng để đánh giá khuyến nghị."
              detail="Cỡ mẫu thấp hoặc thiếu khiến số dễ dao động hơn, nên không nên đọc độ tin cậy như một cam kết kết quả."
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

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChecklistPanel title="Nguồn dữ liệu" items={dataSourceItems} empty="Chưa có nguồn dữ liệu được gắn với khuyến nghị." />
            <ListPanel title="Dữ liệu còn thiếu" items={missingDataLabels} empty="Chưa ghi nhận dữ liệu thiếu rõ ràng." tone="amber" />
          </div>
        </Panel>

        <Panel eyebrow="3" title="Ý nghĩa điểm tín hiệu">
          <p className="mb-4 max-w-3xl text-sm leading-6 text-slate-300">
            Hệ thống gom dữ liệu thành các ý nghĩa dễ đọc hơn bên dưới. Mỗi thành phần cho biết yếu tố nào làm điểm mạnh hơn hoặc yếu hơn.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {componentOrder(data).map((key) => (
              <MetricCard
                key={key}
                label={SCORE_COMPONENT_TITLES[key] ?? 'Thành phần điểm bổ sung'}
                value={componentAvailabilityLabel(key, data)}
                source="Lấy từ đâu: bản diễn giải điểm tín hiệu của khuyến nghị."
                detail={data.componentDescriptions?.[key] ?? FALLBACK_COMPONENT_DESCRIPTIONS[key] ?? 'Thành phần điểm bổ sung từ dữ liệu hiện có.'}
                tone={componentHasValue(key, data) ? (key === 'finalScore' ? 'green' : 'slate') : 'amber'}
              />
            ))}
          </div>
        </Panel>

        <Panel eyebrow="4" title="Vì sao độ tin cậy tăng/giảm">
          <div className="grid gap-4 lg:grid-cols-2">
            <ListPanel title="Yếu tố làm tăng niềm tin" items={data.positiveFactors} empty="Chưa đủ dữ liệu để xác định yếu tố tích cực rõ ràng." tone="green" />
            <ListPanel title="Yếu tố làm giảm hoặc cần thận trọng" items={data.negativeFactors} empty="Chưa có yếu tố hạn chế rõ ràng." tone="amber" />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <MetricCard
              label="Giới hạn độ tin cậy"
              value={data.confidenceCap === null || data.confidenceCap === undefined ? 'Chưa có dữ liệu' : formatConfidence(data.confidenceCap)}
              source="Lấy từ đâu: giới hạn trần độ tin cậy sau khi xét bối cảnh dữ liệu."
              detail="Giới hạn này đặc biệt quan trọng khi token còn ít lịch sử hoặc dữ liệu lịch sử chưa đủ dày."
              tone="amber"
            />
            <MetricCard
              label="Mức giảm do mẫu ít"
              value={data.sampleSizePenalty === null || data.sampleSizePenalty === undefined ? 'Chưa đủ dữ liệu' : formatNumber(data.sampleSizePenalty, 2)}
              source="Lấy từ đâu: cỡ mẫu quan sát được của khuyến nghị."
              detail="Khi số quan sát còn mỏng, hệ thống giảm độ tin cậy để tránh đọc tín hiệu quá chắc."
              tone="amber"
            />
            <MetricCard
              label="Ngưỡng tín hiệu"
              value={formatNumber(data.thresholds.signalThreshold, 4)}
              source="Lấy từ đâu: ngưỡng hệ thống dùng để xem một điểm là đáng chú ý."
              detail="Ngưỡng này cho biết score cần mạnh tới đâu để được xem là tín hiệu đáng chú ý."
              tone="slate"
            />
          </div>
        </Panel>

        <Panel eyebrow="5" title="Kiểm chứng và giới hạn">
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <ChecklistPanel title="Vì sao có thể tin" items={trustItems} empty="Chưa có trust checklist." />
            <CautionPanel title="Không nên tin quá mức" items={cautionItems} empty="Chưa có caution checklist." />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <MetricCard
              label="Kết quả kiểm chứng"
              value={hasBacktest ? backtest?.label ?? 'Có kết quả kiểm chứng' : 'Chưa kiểm chứng'}
              source="Lấy từ đâu: PnL, trạng thái thắng/thua và dữ liệu kiểm chứng trong chi tiết khuyến nghị."
              detail={hasBacktest
                ? `Kết quả quá khứ ghi nhận net PnL ${formatPercent(backtest?.netPnlPct)}. Đây là kiểm chứng lịch sử, không phải bảo đảm lợi nhuận tương lai.`
                : 'Chưa có kết quả kiểm chứng nên không trình bày mục này như bằng chứng lợi nhuận.'}
              tone={hasBacktest ? 'green' : 'amber'}
            />
            <MetricCard
              label="Giới hạn diễn giải"
              value="Không phải xác suất lời"
              source="Lấy từ đâu: quy tắc diễn giải độ tin cậy của màn Advanced."
              detail="Độ tin cậy chỉ nói tín hiệu có bao nhiêu dữ kiện ủng hộ sau các giới hạn kỹ thuật, không nói chắc giao dịch sẽ thắng."
              tone="red"
            />
          </div>

          <div className="mt-4 space-y-3">
            {data.auditTrail.length ? data.auditTrail.map((item) => (
              <div key={item.step} className="rounded-lg border border-white/5 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">{item.step}</p>
                  <Badge variant="outline" className={auditTone(item.status)}>{item.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
              </div>
            )) : (
              <p className="rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">Chưa có lịch sử kiểm tra.</p>
            )}
          </div>
        </Panel>

        <Panel eyebrow="6" title="Công thức dễ đọc">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Formula label="Độ tin cậy" value="Độ mạnh tín hiệu x độ tin cậy nguồn x độ mới dữ liệu x độ rộng mẫu x mức dữ liệu còn thiếu" />
              <Formula label="Điểm tín hiệu" value="So sánh độ bất thường của token với lịch sử, thị trường cùng thời điểm và bối cảnh thời gian" />
            </div>
            <div className="grid gap-3">
              <Mini label="Kết quả định lượng" value={formatNumber(data.finalScore, 2)} />
              <Mini label="Ngưỡng hành động" value={formatNumber(data.thresholds.actionThreshold, 2)} />
              <Mini label="Ngưỡng tín hiệu" value={formatNumber(data.thresholds.signalThreshold, 2)} />
              <Mini label="Bối cảnh dữ liệu" value={signalModeLabel} />
            </div>
          </div>
        </Panel>

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
              <p className="text-sm font-semibold text-white">{item.label}</p>
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
              <p className="text-sm font-semibold text-white">{item.label}</p>
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
  if (mode === 'COLD_START') return 'Token còn ít lịch sử';
  if (mode === 'NORMALIZED_ALPHA') return 'Có dữ liệu so sánh';
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
      label: 'Sample size',
      status: sampleMissing ? 'MISSING' : data.sampleSizePenalty !== null && data.sampleSizePenalty !== undefined && data.sampleSizePenalty < 1 ? 'LIMITED' : 'OK',
      detail: sampleMissing
        ? 'Chưa đủ dữ liệu để đọc độ rộng mẫu.'
        : `Cỡ mẫu hiện có: ${data.sampleSize}.`,
    },
    {
      label: 'Kết quả kiểm chứng/PnL',
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
      label: 'Sample size đủ tin cậy',
      status: sampleMissing ? 'MISSING' : data.sampleSizePenalty !== null && data.sampleSizePenalty !== undefined && data.sampleSizePenalty < 1 ? 'LIMITED' : 'OK',
      detail: sampleMissing
        ? 'Thiếu cỡ mẫu nên chưa đánh giá được độ rộng mẫu.'
        : data.sampleSizePenalty !== null && data.sampleSizePenalty !== undefined && data.sampleSizePenalty < 1
          ? `Cỡ mẫu thấp nên độ tin cậy bị giảm còn ${data.sampleSizePenalty}.`
          : 'Cỡ mẫu không làm giảm độ tin cậy theo dữ liệu hiện có.',
    },
    {
      label: 'Chế độ signal',
      status: String(signalMode).toUpperCase() === 'COLD_START' ? 'LIMITED' : 'OK',
      detail: String(signalMode).toUpperCase() === 'COLD_START'
        ? 'Token còn ít lịch sử, nên độ tin cậy bị giới hạn thấp hơn.'
        : 'Dữ liệu hiện có đủ hơn để so sánh với lịch sử trước đó.',
    },
    {
      label: 'Kết quả kiểm chứng/PnL',
      status: hasBacktest ? 'OK' : 'MISSING',
      detail: hasBacktest ? 'Có kết quả quá khứ để tham chiếu.' : 'Chưa có kết quả kiểm chứng/PnL.',
    },
    {
      label: 'Missing data',
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
      label: 'Token còn ít lịch sử',
      detail: 'Thiếu lịch sử so sánh; độ tin cậy bị giới hạn thấp hơn để tránh tin quá mức.',
    });
  }

  if (data.sampleSizePenalty !== null && data.sampleSizePenalty !== undefined && data.sampleSizePenalty < 1) {
    items.push({
      label: 'Sample size thấp',
      detail: `Cỡ mẫu thấp nên độ tin cậy bị giảm còn ${data.sampleSizePenalty}.`,
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
