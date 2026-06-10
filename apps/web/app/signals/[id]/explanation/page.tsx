'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { CountdownBadge, DataSkeleton, EmptyState, PageHeader, SourceList } from '@/app/components/shared/NdlUi';
import { useProposalDetail, useSignalDetail } from '@/lib/hooks/useNdlData';
import { formatNumber, toDisplayAction } from '@/lib/utils/formatters';

export default function SignalExplanationPage() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();
  const signalId = String(params.id ?? '');
  const proposalId = search.get('proposal') ?? undefined;
  const signal = useSignalDetail(signalId);
  const proposal = useProposalDetail(proposalId);
  const source = proposal.data ?? signal.data?.enrichedProposal;
  const confidence = source?.confidence ?? signal.data?.confidence ?? null;

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Button>

        {signal.isLoading || (proposalId && proposal.isLoading) ? (
          <DataSkeleton rows={3} />
        ) : !signal.data ? (
          <EmptyState title="Không tìm thấy dữ liệu hỗ trợ" />
        ) : (
          <>
            <PageHeader
              eyebrow="Giải thích khuyến nghị"
              title={signal.data.tokenSymbol ?? source?.tokenSymbol ?? 'Token chưa định danh'}
              description="Khuyến nghị diễn giải điểm tín hiệu và nội dung nguồn thành luận điểm tiếng Việt. Dữ liệu kỹ thuật chỉ đóng vai trò giải thích phía sau."
              actions={
                <>
                  <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                    <Link href={`/signals/${signalId}`}>Xem dữ liệu hỗ trợ</Link>
                  </Button>
                  {source?._id ? (
                    <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                      <Link href={`/proposal/${source._id}`}>Mở khuyến nghị</Link>
                    </Button>
                  ) : null}
                </>
              }
            />

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-300" variant="outline">
                  Kết luận: {toDisplayAction(source?.action ?? signal.data.suggestionType)}
                </Badge>
                <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" variant="outline">
                  Điểm tín hiệu {formatNumber(source?.quantScore ?? signal.data.quantScore, 2)}
                </Badge>
                <Badge className="border-green-500/30 bg-green-500/10 text-green-300" variant="outline">
                  Tin cậy {confidence === null || confidence === undefined ? 'Chưa có dữ liệu' : `${confidence}%`}
                </Badge>
                <CountdownBadge value={source?.expiresAt ?? signal.data.expiresAt} />
              </div>
              <p className="mt-5 text-lg leading-relaxed text-slate-100">
                {source?.summary ?? source?.rationaleSummary ?? signal.data.rationaleSummary ?? 'Chưa có dữ liệu giải thích AI.'}
              </p>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Tin tức/tweet hỗ trợ kết luận</h2>
                <div className="mt-4">
                  <SourceList sources={source?.sources ?? signal.data.sources} />
                </div>
              </div>

              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Điều kiện làm khuyến nghị sai</h2>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <p>Signal có thể yếu đi nếu nguồn tin bị phủ nhận, giá đi ngược hướng Entry/Exit hoặc liquidity thay đổi mạnh.</p>
                  <p>{signal.data.metadata?.isNewToken ? 'Token còn ít lịch sử, nên giảm size hoặc chỉ theo dõi.' : 'Dữ liệu đang đủ để đọc, nhưng vẫn cần kiểm tra thời hạn hiệu lực trước khi vào lệnh.'}</p>
                  <p>Không vào lệnh nếu khuyến nghị đã hết hiệu lực hoặc token đang thiếu dữ liệu giá.</p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
