'use client';

import Link from 'next/link';
import type React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useProposalDetail, useProposalScoreExplanation } from '@/lib/hooks/useNdlData';
import { formatConfidence, formatNumber } from '@/lib/utils/formatters';

const MISSING_DATA_LABELS: Record<string, string> = {
  'proposal.sources': 'Thiếu nguồn dữ liệu của khuyến nghị',
  'signal.sources': 'Thiếu nguồn dữ liệu định lượng',
  'signalContext.sources': 'Thiếu nguồn dữ liệu định lượng',
  'metadata.sampleSize': 'Thiếu cỡ mẫu',
  'scoreComponents.sampleSize': 'Thiếu cỡ mẫu',
  sampleSize: 'Thiếu cỡ mẫu',
  backtest: 'Chưa có kết quả kiểm chứng',
  price: 'Thiếu dữ liệu giá',
  currentPrice: 'Thiếu giá hiện tại',
  currentValue: 'Thiếu giá trị hiện tại',
};

export default function ConfidenceExplanationPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const proposal = useProposalDetail(id);
  const explanation = useProposalScoreExplanation(id);
  const data = explanation.data;
  const proposalData = proposal.data;
  const equation = data ? buildConfidenceEquation(data, proposalData?.confidence) : null;

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Button>

        {proposal.isLoading || explanation.isLoading ? (
          <DataSkeleton rows={5} />
        ) : !data ? (
          <EmptyState title="Không có dữ liệu cách tính độ tin cậy" />
        ) : (
          <>
            <PageHeader
              eyebrow="Cách tính độ tin cậy"
              title={`${proposalData?.tokenSymbol ?? 'Token chưa định danh'} · Vì sao có mức tin cậy này?`}
              description="Màn này hiển thị công thức, giá trị đầu vào, bước thay số và kết quả cuối. Độ tin cậy không phải xác suất chắc chắn có lời."
              actions={
                <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                  <Link href={`/proposal/${id}/explanation/quant`}>Xem breakdown điểm tín hiệu</Link>
                </Button>
              }
            />

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Công thức độ tin cậy</h2>
                  <p className="mt-1 text-sm text-slate-500">Tính từ điểm tín hiệu, hệ số quy đổi, giới hạn trần và mức giảm khi dữ liệu còn mỏng.</p>
                </div>
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-200">Kết quả cuối</p>
                  <p className="mt-1 text-3xl font-black text-white">{formatConfidence(data.confidence ?? proposalData?.confidence, 1)}</p>
                </div>
              </div>

              {equation?.complete ? (
                <div className="mt-5 space-y-4">
                  <VariableGrid variables={equation.variables} />
                  <div className="grid gap-3 lg:grid-cols-3">
                    <EquationStep index="1" title="Công thức" value={equation.formula} />
                    <EquationStep index="2" title="Thay số" value={equation.substitution} />
                    <EquationStep index="3" title="Kết quả" value={equation.result} highlight />
                  </div>
                </div>
              ) : (
                <EmptyState title="Chưa đủ dữ liệu để hiển thị phép tính chi tiết." description="UI chỉ hiển thị phần có dữ liệu và không tự bịa field còn thiếu." />
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ExplanationCard
                title="Cách đọc nhanh"
                body={data.signalMode === 'COLD_START'
                  ? 'Token còn ít lịch sử nên độ tin cậy được giới hạn tối đa 40%.'
                  : 'Khi dữ liệu lịch sử đầy đủ hơn, độ tin cậy vẫn có giới hạn trần và mức giảm để tránh đọc tín hiệu quá chắc khi mẫu còn mỏng.'}
              />
              <ExplanationCard
                title="Dữ liệu còn thiếu"
                body={(data.missingData ?? []).length
                  ? `Còn thiếu: ${data.missingData.map(readableMissingData).join(', ')}.`
                  : 'Chưa ghi nhận dữ liệu thiếu rõ ràng cho phép tính này.'}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ListPanel title="Yếu tố làm tăng niềm tin" items={data.positiveFactors} tone="green" empty="Chưa đủ dữ liệu để xác định yếu tố làm tăng độ tin cậy." />
              <ListPanel title="Yếu tố làm giảm hoặc cần thận trọng" items={data.negativeFactors} tone="amber" empty="Chưa đủ dữ liệu để xác định yếu tố làm giảm độ tin cậy." />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Checklist title="Vì sao có thể tin" items={data.trustChecklist ?? []} empty="Chưa có trust checklist." />
              <Checklist title="Không nên tin quá mức" items={data.cautionChecklist?.map((item) => ({ ...item, status: 'LIMITED' as const })) ?? []} empty="Chưa có caution checklist." />
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Dữ liệu còn thiếu</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(data.missingData ?? []).length ? data.missingData.map((item) => (
                  <Badge key={item} variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">{readableMissingData(item)}</Badge>
                )) : <p className="text-sm text-slate-500">Chưa ghi nhận dữ liệu thiếu rõ ràng.</p>}
              </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function readableMissingData(value: string) {
  return MISSING_DATA_LABELS[value] ?? 'Dữ liệu chưa đủ rõ để giải thích';
}

type FormulaVariable = {
  label: string;
  value: React.ReactNode;
  detail: string;
};

function VariableGrid({ variables }: { variables: FormulaVariable[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {variables.map((variable) => (
        <div key={variable.label} className="rounded-xl border border-white/5 bg-black/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{variable.label}</p>
          <p className="mt-2 text-xl font-black text-white">{variable.value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{variable.detail}</p>
        </div>
      ))}
    </div>
  );
}

function EquationStep({ index, title, value, highlight }: { index: string; title: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-green-500/20 bg-green-500/10' : 'border-white/5 bg-black/40'}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-xs font-black text-cyan-200">{index}</span>
        <p className="text-sm font-bold text-white">{title}</p>
      </div>
      <code className="mt-3 block whitespace-pre-wrap break-words rounded-lg bg-black/40 px-3 py-2 text-sm leading-6 text-cyan-100">{value}</code>
    </div>
  );
}

function ExplanationCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
    </section>
  );
}

function ListPanel({ title, items, tone, empty }: { title: string; items: string[]; tone: 'green' | 'amber'; empty: string }) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="mt-4 space-y-2">
        {items.length ? items.map((item) => (
          <div key={item} className={`rounded-lg border px-3 py-2 text-sm ${tone === 'green' ? 'border-green-500/20 bg-green-500/10 text-green-100' : 'border-amber-500/20 bg-amber-500/10 text-amber-100'}`}>
            {item}
          </div>
        )) : <p className="text-sm text-slate-500">{empty}</p>}
      </div>
    </section>
  );
}

function Checklist({ title, items, empty }: { title: string; items: Array<{ label: string; status?: string; detail: string }>; empty: string }) {
  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="mt-4 space-y-2">
        {items.length ? items.map((item) => (
          <div key={`${item.label}-${item.detail}`} className="rounded-lg border border-white/5 bg-black/30 p-3">
            <div className="flex items-center gap-2">
              {item.status === 'OK' ? <ShieldCheck className="h-4 w-4 text-green-300" /> : <TriangleAlert className="h-4 w-4 text-amber-300" />}
              <p className="font-semibold text-white">{item.label}</p>
            </div>
            <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
          </div>
        )) : <p className="text-sm text-slate-500">{empty}</p>}
      </div>
    </section>
  );
}

function isNumber(value: unknown): value is number {
  return Number.isFinite(Number(value));
}

function decimal(value: number, digits = 3) {
  return Number(value).toFixed(digits);
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function buildConfidenceEquation(data: NonNullable<ReturnType<typeof useProposalScoreExplanation>['data']>, fallbackConfidence?: number | null) {
  const finalScore = data.finalScore;
  const isColdStart = data.signalMode === 'COLD_START';
  const divisor = isColdStart ? data.thresholds.coldStartConfidenceDivisor : data.thresholds.confidenceDivisor;
  const cap = isColdStart ? 0.4 : 0.95;
  const penalty = isColdStart ? 1 : data.sampleSizePenalty;

  const complete = isNumber(finalScore) && isNumber(divisor) && divisor > 0 && isNumber(cap) && isNumber(penalty);
  if (!complete) {
    return {
      complete: false,
      variables: [],
      formula: '',
      substitution: '',
      result: '',
    };
  }

  const raw = Math.min(Math.abs(Number(finalScore)) / Number(divisor), cap);
  const result = raw * Number(penalty);
  const displayed = isNumber(data.confidence)
    ? (Number(data.confidence) > 1 ? Number(data.confidence) / 100 : Number(data.confidence))
    : isNumber(fallbackConfidence)
      ? (Number(fallbackConfidence) > 1 ? Number(fallbackConfidence) / 100 : Number(fallbackConfidence))
      : result;

  return {
    complete: true,
    variables: [
      { label: 'Điểm tín hiệu', value: decimal(Number(finalScore)), detail: 'Độ mạnh tín hiệu cuối cùng.' },
      { label: isColdStart ? 'hệ số token ít lịch sử' : 'hệ số độ tin cậy', value: decimal(Number(divisor), 2), detail: 'Hệ số chia để đổi điểm thành độ tin cậy.' },
      { label: 'Giới hạn trần', value: percent(cap), detail: 'Trần độ tin cậy để tránh đọc quá chắc.' },
      { label: 'Mức giảm do mẫu ít', value: decimal(Number(penalty), 2), detail: 'Mức giảm khi cỡ mẫu còn mỏng.' },
    ],
    formula: isColdStart
      ? 'Độ tin cậy = min(abs(điểm cuối) / hệ số token ít lịch sử, 0.4)'
      : 'Độ tin cậy = min(abs(điểm cuối) / hệ số độ tin cậy, 0.95) x mức giảm do cỡ mẫu',
    substitution: isColdStart
      ? `Độ tin cậy = min(abs(${decimal(Number(finalScore))}) / ${decimal(Number(divisor), 2)}, 0.4)`
      : `Độ tin cậy = min(abs(${decimal(Number(finalScore))}) / ${decimal(Number(divisor), 2)}, 0.95) x ${decimal(Number(penalty), 2)}`,
    result: `Độ tin cậy = ${percent(displayed)}`,
  };
}
