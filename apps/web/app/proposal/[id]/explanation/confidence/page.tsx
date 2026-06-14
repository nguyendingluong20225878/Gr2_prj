'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useProposalDetail, useProposalScoreExplanation } from '@/lib/hooks/useNdlData';
import { formatConfidence } from '@/lib/utils/formatters';

export default function ConfidenceExplanationPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const proposal = useProposalDetail(id);
  const explanation = useProposalScoreExplanation(id);
  const data = explanation.data;
  const proposalData = proposal.data;
  const equation = data ? buildConfidenceEquation(data, proposalData?.confidence) : null;
  const confidence = data?.displayConfidence ?? data?.confidence ?? proposalData?.confidence;
  const reasonCards = data?.reasonCards?.filter((card) => card.visible) ?? [];

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
              eyebrow="Độ tin cậy"
              title={`${proposalData?.tokenSymbol ?? 'Token chưa định danh'} · Có nên tin luận điểm này?`}
              description="Trang này chỉ giữ lại phần giúp người dùng hiểu mức tin cậy. Công thức chi tiết được thu gọn để không làm nhiễu quyết định."
              actions={
                <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                  <Link href={`/proposal/${id}/explanation/quant`}>Xem breakdown điểm tín hiệu</Link>
                </Button>
              }
            />

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-200">Độ tin cậy cuối cùng</p>
                  <p className="mt-2 text-5xl font-black text-white">{formatConfidence(confidence, 1)}</p>
                  <p className="mt-2 text-sm font-semibold text-cyan-100">{confidenceLabel(confidence)}</p>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Ý nghĩa</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {data.primaryExplanation ?? 'Độ tin cậy cho biết hệ thống tin vào luận điểm hiện tại đến mức nào. Đây không phải xác suất chắc chắn có lời.'}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Người dùng chỉ cần theo dõi con số cuối cùng này; các biến trung gian chỉ phục vụ audit.
                  </p>
                </div>
              </div>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Vì sao có mức tin cậy này?</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {reasonCards.length ? reasonCards.map((card) => (
                  <ReasonCard key={card.id} title={card.title} body={card.body} tone={card.tone} />
                )) : (
                  <p className="text-sm text-slate-500">Chưa đủ dữ liệu giải thích chi tiết cho mức tin cậy này.</p>
                )}
              </div>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Cách hệ thống đi tới con số cuối</h2>
              <p className="mt-1 text-sm text-slate-500">Biểu diễn theo luồng để dễ đọc hơn công thức thô.</p>
              <FormulaFlow
                steps={[
                  'Đọc tín hiệu đầu vào',
                  'Quy đổi thành độ tin cậy',
                  'Giới hạn để tránh quá tự tin',
                  'Điều chỉnh nếu dữ liệu còn mỏng',
                  'Hiển thị độ tin cậy cuối cùng',
                ]}
              />

              <details className="mt-5 rounded-xl border border-white/5 bg-black/30 p-4">
                <summary className="cursor-pointer text-sm font-bold text-cyan-200">Xem audit công thức</summary>
                {equation?.complete ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <EquationStep index="1" title="Công thức" value={equation.formula} />
                    <EquationStep index="2" title="Thay số" value={equation.substitution} />
                    <EquationStep index="3" title="Kết quả" value={equation.result} highlight />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Chưa đủ dữ liệu để hiển thị phép tính chi tiết.</p>
                )}
              </details>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function confidenceLabel(value?: number | null) {
  if (value === null || value === undefined) return 'Chưa có dữ liệu';
  const normalized = Number(value) <= 1 ? Number(value) * 100 : Number(value);
  if (normalized >= 75) return 'Mạnh';
  if (normalized >= 55) return 'Khá mạnh';
  if (normalized >= 35) return 'Cần đọc thận trọng';
  return 'Thấp';
}

function ReasonCard({ body, title, tone }: { title: string; body: string; tone: 'positive' | 'caution' | 'neutral' }) {
  const className = tone === 'positive'
    ? 'border-green-500/20 bg-green-500/10 text-green-100'
    : tone === 'caution'
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-100'
      : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100';

  return (
    <article className={`rounded-lg border p-4 ${className}`}>
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6">{body}</p>
    </article>
  );
}

function FormulaFlow({ steps }: { steps: string[] }) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-5">
      {steps.map((step, index) => (
        <div key={step} className="relative rounded-xl border border-white/5 bg-black/30 p-4 text-center">
          <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-sm font-black text-cyan-200">{index + 1}</span>
          <p className="mt-3 text-sm font-semibold leading-5 text-slate-200">{step}</p>
          {index < steps.length - 1 ? <span className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 bg-cyan-500/30 md:block" /> : null}
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
