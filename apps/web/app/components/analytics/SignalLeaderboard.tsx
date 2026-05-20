'use client';

import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { SignalAnalyticsRow } from '@/lib/types/analytics';
import { ProposalCardSocial } from '@/app/components/dashboard/SignalCardSocial';

export function SignalLeaderboard({ rows }: { rows: SignalAnalyticsRow[] }) {
  const strongest = rows.filter((row) => row.signalScore > 0).slice(0, 3);
  const weakest = rows.filter((row) => row.signalScore < 0).slice(-3).reverse();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4 text-green-400" />
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Strongest Signals</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-1 gap-3">
          {strongest.map((row) => (
            <ProposalCardSocial
              key={row.id}
              proposal={{
                _id: row.id,
                signalId: row.id,
                tokenSymbol: row.tokenSymbol,
                tokenName: row.tokenName,
                action: row.action,
                title: row.rationaleSummary,
                summary: row.rationaleSummary,
                confidence: row.confidence,
                financialImpact: {
                  currentValue: 0,
                  projectedValue: 0,
                  percentChange: row.signalScore,
                  riskLevel: row.divergence === 'None' ? 'MEDIUM' : 'HIGH',
                },
                expiresAt: row.expiresAt,
              }}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ArrowDownRight className="w-4 h-4 text-red-400" />
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Weakest Signals</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-1 gap-3">
          {weakest.map((row) => (
            <ProposalCardSocial
              key={row.id}
              proposal={{
                _id: row.id,
                signalId: row.id,
                tokenSymbol: row.tokenSymbol,
                tokenName: row.tokenName,
                action: row.action,
                title: row.rationaleSummary,
                summary: row.rationaleSummary,
                confidence: row.confidence,
                financialImpact: {
                  currentValue: 0,
                  projectedValue: 0,
                  percentChange: row.signalScore,
                  riskLevel: row.divergence === 'None' ? 'MEDIUM' : 'HIGH',
                },
                expiresAt: row.expiresAt,
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
