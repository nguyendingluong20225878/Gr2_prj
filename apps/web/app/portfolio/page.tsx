'use client';

import Link from 'next/link';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/app/components/layout/Layout';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { useAuth } from '@/app/contexts/AuthContext';
import { DataSkeleton, EmptyState, HoldingRow, MetricCard, PageHeader, ProposalCard } from '@/app/components/shared/NdlUi';
import { useNdlData } from '@/lib/hooks/useNdlData';
import { formatCurrency } from '@/lib/utils/formatters';
import { getLatestActiveProposalPerToken, isProposalForHoldings } from '@/lib/utils/proposals';
import { isExpiringSoon } from '@/lib/utils/time';

export default function PortfolioPage() {
  const { setUser } = useAuth();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { portfolio, proposals } = useNdlData();

  const data = portfolio.data;
  const totalValue = data?.stats?.totalValue ?? null;
  const totalValueLabel = data?.stats?.totalValueStatus === 'MISSING_PRICE_DATA' ? 'Chưa đủ dữ liệu giá' : formatCurrency(totalValue);
  const relatedProposals = getLatestActiveProposalPerToken(proposals.data ?? [])
    .filter((proposal) => isProposalForHoldings(proposal, data?.holdings ?? []))
    .slice(0, 3);

  const handleSyncBalances = async () => {
    if (!publicKey) {
      toast.error('Vui lòng kết nối ví trước.');
      return;
    }

    try {
      const balances: Array<{ tokenAddress: string; balance: string; updatedAt: Date }> = [];
      const solBalance = await connection.getBalance(publicKey);
      balances.push({
        tokenAddress: 'So11111111111111111111111111111111111111112',
        balance: (solBalance / LAMPORTS_PER_SOL).toString(),
        updatedAt: new Date(),
      });

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      tokenAccounts.value.forEach((account) => {
        const info = account.account.data.parsed.info;
        const amount = info.tokenAmount.uiAmountString;
        if (Number(amount) > 0) {
          balances.push({ tokenAddress: info.mint, balance: amount, updatedAt: new Date() });
        }
      });

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balances }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không đồng bộ được ví');
      if (result.user) setUser(result.user);
      await portfolio.mutate();
      await proposals.mutate();
      toast.success(`Đã đồng bộ ${balances.length} tài sản.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không đồng bộ được ví');
    }
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <PageHeader
          eyebrow="Danh mục"
          title="Tài sản bạn đang nắm giữ"
          description="Đây là đầu vào chính để NDL cá nhân hóa khuyến nghị, cảnh báo thiếu dữ liệu giá và gợi ý hành động theo từng Token."
          actions={
            <>
              <Button onClick={handleSyncBalances} variant="outline" className="border-cyan-500/30 text-cyan-300">
                <RefreshCw className="h-4 w-4" /> Cập nhật ví và giá
              </Button>
              <Button asChild className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white">
                <Link href="/diagnostics">Xem chẩn đoán</Link>
              </Button>
            </>
          }
        />

        {portfolio.isLoading ? (
          <DataSkeleton rows={4} />
        ) : portfolio.error ? (
          <EmptyState title="Không tải được danh mục" description={portfolio.error.message} />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Tổng giá trị danh mục" value={totalValueLabel} />
              <MetricCard label="Holdings" value={data?.holdings?.length ?? 0} />
              <MetricCard label="Vị thế trade đang mở" value={data?.investments?.length ?? 0} hint="Lệnh đã execute từ proposal" />
              <MetricCard label="Đề xuất đang chờ" value={data?.watchlist?.length ?? 0} hint="Từ /api/proposals" />
            </section>

            <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
              <h2 className="text-lg font-bold text-white">Danh sách holdings</h2>
              <div className="mt-4 space-y-3">
                {(data?.holdings ?? []).map((holding) => (
                  <Link key={holding.tokenAddress ?? holding.symbol} href={`/tokens/${holding.symbol}`}>
                    <HoldingRow holding={holding} totalValue={totalValue} />
                  </Link>
                ))}
                {!data?.holdings?.length ? <EmptyState title="Chưa có dữ liệu holdings" description="Hãy đồng bộ ví để cập nhật số dư Blockchain." /> : null}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Vị thế trade đang mở</h2>
                <p className="mt-1 text-sm text-slate-500">Lệnh đã execute từ proposal.</p>
                <div className="mt-4 space-y-3">
                  {(data?.investments ?? []).map((position) => (
                    <Link key={position._id} href={`/positions/${position._id}`} className="block rounded-xl border border-white/5 bg-black/40 p-4 hover:border-cyan-500/30">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-white">{position.symbol ?? position.tokenSymbol ?? 'TOKEN'}</p>
                          <p className="text-sm text-slate-500">{position.direction ?? 'Long/Short'} · Leverage {position.leverage ?? 1}x</p>
                        </div>
                        <p className="text-sm font-bold text-cyan-300">{formatCurrency(position.size)}</p>
                      </div>
                    </Link>
                  ))}
                  {!data?.investments?.length ? <p className="text-sm text-slate-500">Chưa có vị thế đang mở.</p> : null}
                </div>
              </div>

              <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
                <h2 className="text-lg font-bold text-white">Đề xuất liên quan đến tài sản bạn đang nắm giữ</h2>
                <p className="mt-1 text-sm text-slate-500">Mỗi token chỉ hiển thị proposal mới nhất còn hiệu lực.</p>
                <div className="mt-4 space-y-3">
                  {proposals.isLoading ? (
                    <DataSkeleton rows={1} />
                  ) : (
                    <>
                      {relatedProposals.map((proposal) => (
                        <div key={proposal._id} className="space-y-2">
                          <ProposalCard proposal={proposal} href={`/proposal/${proposal._id}`} />
                          {isExpiringSoon(proposal.expiresAt, 6 * 60 * 60 * 1000) ? (
                            <Badge className="w-fit border-amber-500/30 bg-amber-500/10 text-amber-300" variant="outline">Sắp hết hạn</Badge>
                          ) : null}
                        </div>
                      ))}
                      {!relatedProposals.length ? (
                        <EmptyState
                          title="Chưa có đề xuất nào phù hợp với tài sản bạn đang nắm giữ."
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
