'use client';

import Link from 'next/link';
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
              eyebrow="Điểm tín hiệu"
              title={`${proposalData?.tokenSymbol ?? 'Token chưa định danh'} · Tín hiệu đang nghiêng về đâu?`}
              description="Trang này tập trung vào kết luận và cách đọc điểm. Công thức và thành phần kỹ thuật được thu gọn trong phần audit."
              actions={
                <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                  <Link href={`/proposal/${id}/explanation/confidence`}>Xem độ tin cậy</Link>
                </Button>
              }
            />

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
                <div className={`rounded-xl border p-5 text-center ${quantTone(finalScore).box}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-200">Điểm tín hiệu</p>
                  <p className="mt-2 text-5xl font-black text-white">{formatNumber(finalScore, 2)}</p>
                  <p className={`mt-2 text-sm font-semibold ${quantTone(finalScore).text}`}>{quantDirection(finalScore)}</p>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Cách đọc nhanh</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{quantSummary(finalScore)}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Điểm này hỗ trợ đọc hướng tín hiệu, không thay thế độ tin cậy, rủi ro và bối cảnh thị trường.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-3">
              <Note title="Tín hiệu riêng của token" body="Hệ thống xem token này có bất thường so với lịch sử của chính nó không." />
              <Note title="Bối cảnh thị trường" body="Tín hiệu được đặt cạnh nhóm thị trường để tránh đọc một điểm dữ liệu rời rạc." />
              <Note title="Kết luận cuối" body="Điểm cuối cho biết tín hiệu nghiêng mua, bán hay trung lập; càng xa 0 thì càng nổi bật." />
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Cách hệ thống gom điểm</h2>
              <p className="mt-1 text-sm text-slate-500">Biểu diễn bằng luồng để dễ đọc hơn công thức thô.</p>
              <FormulaFlow
                steps={data?.quantFormulaMode === 'PURE_ALPHA_FALLBACK'
                  ? ['Đọc tín hiệu token', 'So với lịch sử token', 'Dùng trực tiếp khi thiếu dữ liệu so sánh', 'Ra điểm tín hiệu']
                  : ['Đọc tín hiệu token', 'So với lịch sử token', 'So với thị trường', 'Trộn trọng số', 'Ra điểm tín hiệu']}
              />
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Audit kỹ thuật</h2>
              <p className="mt-1 text-sm text-slate-500">Mở khi cần kiểm tra công thức, biến đầu vào và từng thành phần điểm.</p>

              <details className="mt-4 rounded-xl border border-white/5 bg-black/30 p-4">
                <summary className="cursor-pointer text-sm font-bold text-cyan-200">Xem công thức và thay số</summary>
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

              <details className="mt-3 rounded-xl border border-white/5 bg-black/30 p-4">
                <summary className="cursor-pointer text-sm font-bold text-cyan-200">Xem thành phần điểm</summary>
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
                    <p className="text-sm text-slate-500">Chưa đủ dữ liệu để tách điểm thành các yếu tố nhỏ hơn.</p>
                  ) : null}
                </div>
              </details>
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

function quantDirection(value?: number | null) {
  if (value === null || value === undefined) return 'Chưa có dữ liệu';
  if (value > 1) return 'Nghiêng mua';
  if (value < -1) return 'Nghiêng bán';
  return 'Gần trung lập';
}

function quantSummary(value?: number | null) {
  if (value === null || value === undefined) return 'Chưa có đủ dữ liệu để kết luận hướng tín hiệu.';
  if (value > 1) return 'Tín hiệu hiện tại nghiêng về hướng mua. Hãy đọc cùng độ tin cậy và rủi ro trước khi hành động.';
  if (value < -1) return 'Tín hiệu hiện tại nghiêng về hướng bán hoặc giảm rủi ro. Hãy đọc cùng vị thế danh mục trước khi hành động.';
  return 'Tín hiệu chưa đủ nổi bật, phù hợp để theo dõi thêm thay vì ra quyết định vội.';
}

function quantTone(value?: number | null) {
  if (value === null || value === undefined) return {
    box: 'border-slate-500/20 bg-slate-500/10',
    text: 'text-slate-300',
  };
  if (value > 1) return {
    box: 'border-green-500/20 bg-green-500/10',
    text: 'text-green-100',
  };
  if (value < -1) return {
    box: 'border-red-500/20 bg-red-500/10',
    text: 'text-red-100',
  };
  return {
    box: 'border-slate-500/20 bg-slate-500/10',
    text: 'text-slate-300',
  };
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
