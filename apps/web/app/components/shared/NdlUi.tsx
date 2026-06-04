'use client';

import { useEffect, useState } from 'react';
import type React from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, ExternalLink } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatConfidence, formatCurrency, formatNumber, formatPercent, normalizePercentValue, toDisplayAction, toDisplayRisk } from '@/lib/utils/formatters';
import { formatExpiry, formatRelativeVietnamese, isExpiringSoon } from '@/lib/utils/time';
import type { Holding, ProposalData, SignalData } from '@/lib/hooks/useNdlData';

function actionBadgeClass(action?: string | null) {
  const upper = String(action ?? '').toUpperCase();
  if (upper === 'BUY' || upper === 'LONG') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (upper === 'SELL' || upper === 'SHORT') return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (upper === 'HOLD' || upper === 'WAIT') return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
  return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">{eyebrow}</p>
        <h1 className="text-4xl font-bold gradient-text">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm text-slate-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="glass-card rounded-xl border border-white/5 bg-black/40 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-3 text-xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function DataSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="glass-card rounded-xl border border-white/5 bg-black/40 p-5">
          <Skeleton className="h-4 w-40 bg-white/10" />
          <Skeleton className="mt-4 h-16 w-full bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="glass-card rounded-xl border border-dashed border-white/10 p-10 text-center">
      <p className="text-lg font-bold text-white">{title}</p>
      {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

export function CountdownBadge({ value }: { value?: string | Date | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const urgent = isExpiringSoon(value, 6 * 60 * 60 * 1000);
  return (
    <Badge className={urgent ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'} variant="outline">
      <Clock className="h-3 w-3" />
      {formatExpiry(value, now)}
    </Badge>
  );
}

export function DataQualityBadge({ value }: { value?: string | null }) {
  const missing = value === 'MISSING_PRICE';
  return (
    <Badge className={missing ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-green-500/30 bg-green-500/10 text-green-300'} variant="outline">
      {missing ? 'Thiếu giá' : 'Dữ liệu OK'}
    </Badge>
  );
}

export function ProposalCard({ proposal, href }: { proposal: ProposalData; href: string }) {
  const roi = normalizePercentValue(proposal.pnlPercentage ?? proposal.financialImpact?.roi);
  const risk = proposal.financialImpact?.riskLevel;
  const roiLabel = proposal.roiStatus === 'NOT_AVAILABLE' || roi === null ? 'Chưa backtest' : formatPercent(roi);
  const action = proposal.action ?? proposal.suggestionType;
  const description = proposal.summary ?? proposal.rationaleSummary ?? proposal.title;
  return (
    <Link href={href} className="glass-card block rounded-xl border border-white/5 bg-black/40 p-5 transition-colors hover:border-cyan-500/30 hover:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-white">{proposal.tokenSymbol ?? 'TOKEN'}</span>
            <Badge className={actionBadgeClass(action)} variant="outline">
              {toDisplayAction(action)}
            </Badge>
            <CountdownBadge value={proposal.expiresAt} />
          </div>
          {description ? <p className="mt-2 line-clamp-2 text-sm text-slate-300">{description}</p> : null}
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Tin cậy" value={formatConfidence(proposal.confidence)} />
        <MiniStat label="Quant" value={proposal.quantScore !== null && proposal.quantScore !== undefined ? formatNumber(proposal.quantScore, 2) : 'Chưa có dữ liệu'} />
        <MiniStat label="ROI/PnL" value={roiLabel} />
        <MiniStat label="Rủi ro" value={toDisplayRisk(risk)} />
      </div>
    </Link>
  );
}

export function SignalCard({ signal, href }: { signal: SignalData; href: string }) {
  const proposal = signal.enrichedProposal;
  const quantScore = signal.quantScore ?? signal.metadata?.scoreComponents?.finalScore ?? proposal?.quantScore;
  return (
    <Link href={href} className="glass-card block rounded-xl border border-white/5 bg-black/40 p-5 transition-colors hover:border-purple-500/30 hover:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-white">{signal.tokenSymbol ?? proposal?.tokenSymbol ?? 'TOKEN'}</span>
            <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-300" variant="outline">
              Signal
            </Badge>
            <Badge className="border-white/10 bg-black/40 text-slate-300" variant="outline">
              {signal.lifecycleState ?? 'QUANT_READY'}
            </Badge>
            <CountdownBadge value={signal.expiresAt} />
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-slate-300">{proposal?.rationaleSummary ?? signal.rationaleSummary ?? 'Chưa có dữ liệu'}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Tin cậy" value={formatConfidence(signal.confidence)} />
        <MiniStat label="Quant" value={formatNumber(quantScore, 2)} />
        <MiniStat label="Nguồn" value={signal.sources?.length ?? 0} />
        <MiniStat label="Phát hiện" value={formatRelativeVietnamese(signal.detectedAt)} />
      </div>
    </Link>
  );
}

export function HoldingRow({ holding, totalValue }: { holding: Holding; totalValue?: number | null }) {
  const allocation = totalValue && holding.value ? (holding.value / totalValue) * 100 : null;
  const priceLabel = holding.price === null || holding.price === undefined ? 'Chưa có giá' : formatCurrency(holding.price);
  const valueLabel = holding.value === null || holding.value === undefined ? 'Chưa đủ dữ liệu giá' : formatCurrency(holding.value);
  return (
    <div className="grid gap-3 rounded-xl border border-white/5 bg-black/40 p-4 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-center">
      <div>
        <p className="font-bold text-white">{holding.symbol}</p>
        <p className="text-xs text-slate-500">Token trong Portfolio</p>
      </div>
      <MiniStat label="Số lượng" value={formatNumber(holding.balance)} />
      <MiniStat label="Giá hiện tại" value={priceLabel} />
      <MiniStat label="Giá trị" value={valueLabel} />
      <div className="flex items-center gap-2 md:justify-end">
        <Badge className="border-white/10 bg-black/40 text-slate-300" variant="outline">
          {allocation === null ? 'Chưa rõ tỷ trọng' : `${allocation.toFixed(1)}%`}
        </Badge>
        <DataQualityBadge value={holding.dataQuality} />
      </div>
    </div>
  );
}

export function SourceList({ sources }: { sources?: Array<string | { label?: string; name?: string; url?: string; sourceKey?: string; weight?: number }> }) {
  const safeSources = sources ?? [];
  if (!safeSources.length) return <p className="text-sm text-slate-500">Chưa có dữ liệu nguồn.</p>;
  return (
    <div className="space-y-2">
      {safeSources.map((source, index) => {
        const url = typeof source === 'string' ? source : source.url;
        const label = typeof source === 'string' ? `Nguồn ${index + 1}` : source.label ?? source.name ?? source.sourceKey ?? `Nguồn ${index + 1}`;
        return (
          <a
            key={`${label}-${index}`}
            href={url || '#'}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-sm text-slate-300 hover:border-cyan-500/30"
          >
            <span className="truncate">{label}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          </a>
        );
      })}
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
