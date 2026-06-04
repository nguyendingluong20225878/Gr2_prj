'use client';

import Link from 'next/link';
import type React from 'react';
import { AlertTriangle, BarChart3, BrainCircuit, LineChart, Search, Wallet } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import {
  DataSkeleton,
  EmptyState,
  HoldingRow,
  MetricCard,
  PageHeader,
  ProposalCard,
  SignalCard,
} from '@/app/components/shared/NdlUi';
import { useNdlData } from '@/lib/hooks/useNdlData';
import { formatCurrency } from '@/lib/utils/formatters';
import { isExpired, isExpiringSoon } from '@/lib/utils/time';
import type { Holding, ProposalData, SignalData } from '@/lib/hooks/useNdlData';

const UNKNOWN_TOKEN_SYMBOL = 'TOKEN CHƯA ĐỊNH DANH';
const FAR_FUTURE = 8_640_000_000_000_000;

const normalizeSymbol = (value?: string | null) => {
  const symbol = value?.trim().toUpperCase();
  if (!symbol || symbol === UNKNOWN_TOKEN_SYMBOL) return null;
  return symbol;
};

const getProposalCreatedTime = (proposal: ProposalData) => new Date(proposal.createdAt ?? 0).getTime();
const getSignalCreatedTime = (signal: SignalData) => new Date(signal.detectedAt ?? 0).getTime();

const byProposalCreatedAtDesc = (a: ProposalData, b: ProposalData) => getProposalCreatedTime(b) - getProposalCreatedTime(a);
const bySignalCreatedAtDesc = (a: SignalData, b: SignalData) => getSignalCreatedTime(b) - getSignalCreatedTime(a);

// Kept for a future "Sắp hết hạn" sort mode.
const byExpiresAtAsc = <T extends { expiresAt?: string | null }>(a: T, b: T) => {
  const aTime = a.expiresAt ? new Date(a.expiresAt).getTime() : FAR_FUTURE;
  const bTime = b.expiresAt ? new Date(b.expiresAt).getTime() : FAR_FUTURE;
  return aTime - bTime;
};

export default function OverviewPage() {
  const { walletAddress, portfolio, proposals, signals, modelHealth } = useNdlData();
  const portfolioData = portfolio.data;
  const proposalList = proposals.data ?? [];
  const signalList = signals.data ?? [];
  const totalValueStatus = portfolioData?.stats?.totalValueStatus;
  const totalValue = portfolioData?.stats?.totalValue ?? null;
  const missingPriceCount = portfolioData?.stats?.missingPriceCount ?? 0;
  const totalValueLabel = totalValueStatus === 'MISSING_PRICE_DATA' ? 'Chưa đủ dữ liệu giá' : formatCurrency(totalValue);
  const totalValueHint = missingPriceCount > 0
    ? `Đã bỏ qua ${missingPriceCount} token thiếu giá`
    : 'Từ /api/portfolio';
  const holdingsForDisplay = [...(portfolioData?.holdings ?? [])].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
  const holdingSymbols = new Set(
    holdingsForDisplay
      .map((holding) => normalizeSymbol(holding.symbol))
      .filter((symbol): symbol is string => Boolean(symbol))
  );
  const pendingProposals = proposalList.filter((proposal) => {
    const status = String(proposal.status ?? '').toLowerCase();
    return status !== 'executed' && !isExpired(proposal.expiresAt);
  });
  const portfolioProposals = pendingProposals.filter((proposal) => {
    const symbol = normalizeSymbol(proposal.tokenSymbol);
    return symbol ? holdingSymbols.has(symbol) : false;
  });
  const topPortfolioProposals = [...portfolioProposals]
    .sort(byProposalCreatedAtDesc)
    .slice(0, 3);
  const portfolioSignals = signalList.filter((signal) => {
    const symbol = normalizeSymbol(signal.tokenSymbol);
    return symbol ? holdingSymbols.has(symbol) : false;
  });
  const topPortfolioSignals: SignalData[] = [...portfolioSignals]
    .sort(bySignalCreatedAtDesc)
    .slice(0, 3);
  const dataWarnings = [
    ...(portfolioData?.holdings ?? [])
      .filter((holding) => holding.dataQuality === 'MISSING_PRICE')
      .map((holding, index) => `${holding.symbol || `Token ${index + 1}`}: thiếu dữ liệu giá`),
    ...portfolioSignals.filter((signal) => isExpiringSoon(signal.expiresAt)).sort(byExpiresAtAsc).slice(0, 3).map((signal) => `${signal.tokenSymbol ?? 'TOKEN'}: Signal sắp hết hạn`),
    ...portfolioProposals.filter((proposal) => isExpiringSoon(proposal.expiresAt)).sort(byExpiresAtAsc).slice(0, 3).map((proposal) => `${proposal.tokenSymbol ?? 'TOKEN'}: đề xuất sắp hết hạn`),
  ];

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <PageHeader
          eyebrow="Tổng quan"
          title="Portfolio trước, Signal sau"
          description="Bắt đầu từ tài sản đang nắm giữ, sau đó xem cơ hội từ news/tweets và hành động nên làm hôm nay."
          actions={
            <>
              <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                <Link href="/recommendations">Xem khuyến nghị</Link>
              </Button>
              <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
                <Link href="/model-health">Xem sức khỏe mô hình</Link>
              </Button>
            </>
          }
        />

        {!walletAddress ? (
          <EmptyState title="Chưa kết nối ví" description="Vui lòng kết nối ví để xem Portfolio và khuyến nghị cá nhân hóa." />
        ) : portfolio.isLoading || proposals.isLoading || signals.isLoading ? (
          <DataSkeleton rows={4} />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Tổng giá trị danh mục" value={totalValueLabel} hint={totalValueHint} />
              <MetricCard label="Tài sản đang nắm giữ" value={portfolioData?.holdings?.length ?? 0} hint="Danh sách cuộn bên dưới" />
              <MetricCard label="Vị thế trade đang mở" value={portfolioData?.investments?.length ?? 0} hint="Lệnh đã execute từ proposal" />
              <MetricCard label="Đề xuất cho danh mục" value={portfolioProposals.length} hint="Khớp token trong ví" />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Tài sản đang nắm giữ</h2>
                    <p className="text-sm text-slate-500">Ưu tiên xem rủi ro và cơ hội trên token bạn đang có.</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="border-white/10">
                    <Link href="/portfolio"><Wallet className="h-4 w-4" /> Xem danh mục</Link>
                  </Button>
                </div>
                <div className="max-h-[330px] space-y-3 overflow-y-auto pr-1">
                  {holdingsForDisplay.length ? holdingsForDisplay.map((holding, index) => <HoldingRow key={holding.tokenAddress ?? `${holding.symbol}-${index}`} holding={holding} totalValue={totalValue} />) : (
                    <EmptyState title="Chưa có holding" description="Đồng bộ ví để NDL đọc danh mục." />
                  )}
                </div>
              </div>

              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Hành động cho danh mục hôm nay</h2>
                    <p className="text-sm text-slate-500">Đề xuất mới nhất cho những token bạn đang nắm giữ.</p>
                  </div>
                  <BarChart3 className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="space-y-3">
                  {topPortfolioProposals.map((proposal) => (
                    <ProposalCard key={proposal._id} proposal={proposal} href={`/proposal/${proposal._id}`} />
                  ))}
                  {!portfolioProposals.length ? (
                    <EmptyState
                      title="Chưa có đề xuất mới cho danh mục"
                      description="Hiện chưa có proposal nào liên quan đến các token bạn đang nắm giữ."
                    />
                  ) : null}
                  {portfolioProposals.length > 3 ? (
                    <Button asChild variant="outline" size="sm" className="border-cyan-500/30 text-cyan-300">
                      <Link href="/recommendations">Xem tất cả</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Tín hiệu ảnh hưởng đến danh mục</h2>
                  <p className="text-sm text-slate-500">News/tweets/signal mới nhất liên quan đến token trong ví.</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-cyan-300">
                  <Link href="/opportunities"><Search className="h-4 w-4" /> Xem thêm</Link>
                </Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {topPortfolioSignals.map((signal) => <SignalCard key={signal._id} signal={signal} href={`/signals/${signal._id}`} />)}
                {!portfolioSignals.length ? (
                  <EmptyState
                    title="Chưa có tín hiệu ảnh hưởng đến danh mục"
                    description="Hiện chưa detected signal mới cho các token trong ví."
                  />
                ) : null}
              </div>
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Cảnh báo dữ liệu</h2>
                  <p className="text-sm text-slate-500">Thiếu giá, Signal hoặc proposal sắp hết hạn.</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-amber-300" />
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {dataWarnings.slice(0, 5).map((warning, index) => (
                  <div key={`${warning}-${index}`} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    {warning}
                  </div>
                ))}
                {!dataWarnings.length ? <p className="text-sm text-slate-500">Không có cảnh báo dữ liệu nghiêm trọng.</p> : null}
              </div>
            </section>

            <section>
              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Điều hướng nhanh</h2>
                <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                  <QuickLink href="/diagnostics" icon={<LineChart className="h-4 w-4" />} label="Xem chẩn đoán" />
                  <QuickLink href="/recommendations" icon={<BarChart3 className="h-4 w-4" />} label="Xem khuyến nghị" />
                  <QuickLink href="/positions" icon={<Wallet className="h-4 w-4" />} label="Xem vị thế" />
                  <QuickLink href="/model-health" icon={<BrainCircuit className="h-4 w-4" />} label={`Sức khỏe mô hình: ${modelHealth.data?.activeConfig?.status ?? 'N/A'}`} />
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/30 px-3 py-3 text-sm text-slate-300 hover:border-cyan-500/30">
      {icon}
      {label}
    </Link>
  );
}
