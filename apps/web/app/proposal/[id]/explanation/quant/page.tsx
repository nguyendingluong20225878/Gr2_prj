'use client';

import Link from 'next/link';
import type React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { DataSkeleton, EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { useProposalDetail, useProposalScoreExplanation } from '@/lib/hooks/useNdlData';
import { formatNumber } from '@/lib/utils/formatters';

const COMPONENT_COPY: Record<string, string> = {
  finalScore: 'Điểm tín hiệu sau khi gom các thành phần định lượng. Giá trị càng xa 0 thì tín hiệu càng mạnh.',
  pureAlphaZ: 'Mức bất thường của token so với chính lịch sử của token đó.',
  crossZ: 'Mức nổi bật của token so với nhóm thị trường cùng thời điểm.',
  timeZ: 'Mức bất thường theo thời gian, giúp tránh đọc một điểm dữ liệu rời rạc quá mạnh.',
  unifiedRaw: 'Điểm thô trước khi chuẩn hóa thành điểm tín hiệu.',
};

const REASONING_STEPS = [
  {
    title: '1. Nhận tín hiệu',
    body: 'Hệ thống đọc tin tức/tweet và dữ liệu thị trường để nhận ra token, hướng tác động và độ mạnh ban đầu.',
  },
  {
    title: '2. Chuyển thành khuyến nghị',
    body: 'Điểm tín hiệu được chuyển thành khuyến nghị có hành động, luận điểm và token liên quan để user đọc được nhanh.',
  },
  {
    title: '3. Cân nhắc tăng/giảm điểm',
    body: 'Điểm tăng khi token nổi bật so với lịch sử hoặc thị trường; điểm giảm khi dữ liệu ít, thiếu nguồn hoặc tín hiệu chưa đủ khác biệt.',
  },
  {
    title: '4. Kết luận cuối',
    body: 'Điểm cuối chỉ là dữ liệu hỗ trợ khuyến nghị. User vẫn cần đọc độ tin cậy, rủi ro và trạng thái kiểm chứng trước khi hành động.',
  },
];

export default function QuantExplanationPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const proposal = useProposalDetail(id);
  const explanation = useProposalScoreExplanation(id);
  const data = explanation.data;
  const proposalData = proposal.data;
  const components: Record<string, unknown> = data?.scoreComponents ?? proposalData?.scoreComponents ?? {};
  const finalScore = data?.finalScore ?? proposalData?.quantScore ?? proposalData?.scoreComponents?.finalScore ?? null;
  const equation = data ? buildQuantEquation(data) : null;

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Button>

        {proposal.isLoading || explanation.isLoading ? (
          <DataSkeleton rows={5} />
        ) : !data && !proposalData ? (
          <EmptyState title="Không có dữ liệu breakdown điểm tín hiệu" />
        ) : (
          <>
            <PageHeader
              eyebrow="Breakdown điểm tín hiệu"
              title={`${proposalData?.tokenSymbol ?? 'Token chưa định danh'} · Điểm tín hiệu đến từ đâu?`}
              description="Breakdown hiển thị công thức, biến đầu vào, bước thay số và điểm tín hiệu cuối. Số chỉ là dữ liệu hỗ trợ khuyến nghị."
              actions={
                <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                  <Link href={`/proposal/${id}/explanation/confidence`}>Xem độ tin cậy</Link>
                </Button>
              }
            />

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Công thức điểm tín hiệu</h2>
                  <p className="mt-1 text-sm text-slate-500">Trộn tín hiệu riêng của token với mức nổi bật so với thị trường để ra điểm cuối.</p>
                </div>
                <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-200">Điểm tín hiệu</p>
                  <p className="mt-1 text-3xl font-black text-white">{formatNumber(finalScore, 3)}</p>
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
                <EmptyState title="Chưa đủ dữ liệu để hiển thị phép tính chi tiết." description="Thiếu dữ liệu trộn điểm hoặc dữ liệu bất thường của token nên chưa thể thay số đầy đủ." />
              )}
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              {REASONING_STEPS.slice(0, 4).map((step) => (
                <Note key={step.title} title={step.title} body={step.body} />
              ))}
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Thành phần điểm</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {componentKeys(components).map((key) => (
                  <div key={key} className="rounded-lg border border-white/5 bg-black/30 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="font-semibold text-white">{componentTitle(key)}</p>
                      <span className="text-sm font-bold text-cyan-300">{formatNumber(componentValue(components[key]), 4)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {data?.componentDescriptions?.[key] ?? COMPONENT_COPY[key] ?? 'Thành phần bổ sung từ dữ liệu hiện có.'}
                    </p>
                  </div>
                ))}
                {!componentKeys(components).length ? (
                  <EmptyState title="Chưa có thành phần điểm" description="Chưa đủ dữ liệu để tách điểm thành các yếu tố nhỏ hơn cho khuyến nghị này." />
                ) : null}
              </div>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Cách đọc điểm</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <Note title="Dương" body="Điểm dương thường nghiêng về mua, nhưng vẫn cần đọc hành động và rủi ro trong khuyến nghị." />
                <Note title="Âm" body="Điểm âm thường nghiêng về bán, nhất là khi khuyến nghị liên quan token bạn đang giữ." />
                <Note title="Gần 0" body="Tín hiệu chưa nổi bật; UI nên đưa vào theo dõi thêm nếu dữ liệu khác chưa đủ mạnh." />
              </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function componentKeys(components: Record<string, unknown>) {
  const preferred = ['finalScore', 'pureAlphaZ', 'crossZ', 'timeZ', 'unifiedRaw'];
  const keys = new Set([...preferred, ...Object.keys(components)]);
  return [...keys].filter((key) => components[key] !== undefined && components[key] !== null);
}

function componentValue(value: unknown) {
  return typeof value === 'number' ? value : null;
}

function componentTitle(key: string) {
  if (key === 'finalScore') return 'Điểm tổng hợp';
  if (key === 'pureAlphaZ') return 'Bất thường theo lịch sử token';
  if (key === 'crossZ') return 'Nổi bật so với thị trường';
  if (key === 'timeZ') return 'Bất thường theo thời gian';
  if (key === 'unifiedRaw') return 'Điểm thô trước chuẩn hóa';
  return key;
}

function readableQuantFormula(value?: string | null) {
  if (!value) return 'Gom độ bất thường theo token, thị trường và thời gian.';
  return 'Gom độ bất thường theo token, thị trường và thời gian; sau đó chuẩn hóa thành điểm tín hiệu.';
}

function readableSignalMode(value?: string | null) {
  const mode = String(value ?? '').toUpperCase();
  if (mode === 'COLD_START') return 'Token còn ít lịch sử, nên cần đọc điểm thận trọng hơn.';
  if (mode === 'NORMALIZED_ALPHA') return 'Có đủ lịch sử hơn để so sánh tín hiệu với bối cảnh trước đó.';
  return 'Chưa đủ dữ liệu để xác định bối cảnh tính điểm.';
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

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 p-4">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
    </div>
  );
}

function isNumber(value: unknown): value is number {
  return Number.isFinite(Number(value));
}

function decimal(value: number, digits = 3) {
  return Number(value).toFixed(digits);
}

function buildQuantEquation(data: NonNullable<ReturnType<typeof useProposalScoreExplanation>['data']>) {
  const components = data.scoreComponents ?? {};
  const mode = data.quantFormulaMode;
  const alphaBlend = data.thresholds.alphaBlend;
  const pureAlphaZ = components.pureAlphaZ;
  const crossZ = components.crossZ;
  const finalScore = data.finalScore ?? components.finalScore;

  if (mode === 'PURE_ALPHA_FALLBACK') {
    const complete = isNumber(pureAlphaZ) && isNumber(finalScore);
    if (!complete) {
      return {
        complete: false,
        variables: [],
        formula: '',
        substitution: '',
        result: '',
      };
    }

    return {
      complete: true,
      variables: [
        { label: 'Bất thường theo lịch sử', value: decimal(Number(pureAlphaZ)), detail: 'Điểm dùng trực tiếp khi token còn ít lịch sử hoặc thiếu dữ liệu so sánh thị trường.' },
        { label: 'Điểm tín hiệu', value: decimal(Number(finalScore)), detail: 'Điểm cuối cho khuyến nghị.' },
      ],
      formula: 'Điểm tín hiệu = mức bất thường theo lịch sử',
      substitution: `Điểm tín hiệu = ${decimal(Number(pureAlphaZ))}`,
      result: `Điểm tín hiệu = ${decimal(Number(finalScore))}`,
    };
  }

  if (mode === 'MISSING_INPUTS' || data.alphaBlendSource !== 'model') {
    return {
      complete: false,
      variables: [],
      formula: '',
      substitution: '',
      result: '',
    };
  }

  const complete = isNumber(alphaBlend) && isNumber(pureAlphaZ) && isNumber(crossZ) && isNumber(finalScore);

  if (!complete) {
    return {
      complete: false,
      variables: [],
      formula: '',
      substitution: '',
      result: '',
    };
  }

  const calculated = Number(alphaBlend) * Number(pureAlphaZ) + (1 - Number(alphaBlend)) * Number(crossZ);

  return {
      complete: true,
      variables: [
        { label: 'Trọng số tín hiệu riêng', value: decimal(Number(alphaBlend), 2), detail: 'Tỷ trọng cho tín hiệu riêng của token.' },
        { label: 'Bất thường theo lịch sử', value: decimal(Number(pureAlphaZ)), detail: 'Độ bất thường so với lịch sử token.' },
        { label: 'Nổi bật so với thị trường', value: decimal(Number(crossZ)), detail: 'Độ nổi bật so với thị trường cùng thời điểm.' },
        { label: 'Điểm tín hiệu', value: decimal(Number(finalScore)), detail: 'Điểm cuối cho khuyến nghị.' },
      ],
    formula: 'Điểm tín hiệu = trọng số riêng x bất thường lịch sử + phần còn lại x nổi bật thị trường',
    substitution: `Điểm tín hiệu = ${decimal(Number(alphaBlend), 2)} x ${decimal(Number(pureAlphaZ))} + (1 - ${decimal(Number(alphaBlend), 2)}) x ${decimal(Number(crossZ))}`,
    result: `Điểm tín hiệu = ${decimal(calculated)}`,
  };
}
