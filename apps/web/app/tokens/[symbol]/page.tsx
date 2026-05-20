'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { SignalHeatmap } from '@/app/components/analytics/SignalHeatmap';
import { TokenMomentumTable } from '@/app/components/analytics/TokenMomentumTable';
import { Button } from '@/app/components/ui/button';
import { useSignalAnalytics } from '@/lib/hooks/useSignalAnalytics';

export default function TokenProfilePage() {
  const params = useParams();
  const router = useRouter();
  const symbol = String(params.symbol || '').toUpperCase();
  const { rows, loading, error } = useSignalAnalytics();
  const tokenRows = useMemo(() => rows.filter((row) => row.tokenSymbol.toUpperCase() === symbol), [rows, symbol]);
  const token = tokenRows[0];

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="text-slate-400 hover:text-white pl-0">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-bold mb-2">Token Intelligence</p>
          <h1 className="text-4xl font-bold gradient-text">{symbol || 'Token'}</h1>
          <p className="text-slate-400 mt-2 max-w-2xl">{token?.tokenName || 'Signal-linked token profile using the current analytics adapter.'}</p>
        </div>

        {error ? (
          <div className="glass-card rounded-xl p-8 border border-red-500/30 text-red-300">{error}</div>
        ) : loading ? (
          <div className="glass-card rounded-xl p-8 text-slate-500">Loading token profile...</div>
        ) : tokenRows.length === 0 ? (
          <div className="glass-card rounded-xl p-12 border border-dashed border-white/10 text-center text-slate-500">
            No signal history for {symbol}.
          </div>
        ) : (
          <>
            <TokenMomentumTable rows={tokenRows} onSelectRow={(row) => router.push(`/proposal/${row.id}`)} />
            <SignalHeatmap rows={tokenRows} />
          </>
        )}
      </div>
    </Layout>
  );
}
