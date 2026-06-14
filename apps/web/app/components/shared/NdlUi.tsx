'use client';

import { useEffect, useId, useState } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, Clock, ExternalLink, X } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatConfidence, formatCurrency, formatNumber, formatPercent, normalizePercentValue, toDisplayAction, toDisplayRisk } from '@/lib/utils/formatters';
import { formatExpiry, formatRelativeVietnamese, isExpired, isExpiringSoon } from '@/lib/utils/time';
import type { Holding, ProposalData, SignalData } from '@/lib/hooks/useNdlData';

function actionBadgeClass(action?: string | null) {
  const upper = String(action ?? '').toUpperCase();
  if (upper === 'BUY' || upper === 'LONG') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (upper === 'SELL' || upper === 'SHORT') return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (upper === 'HOLD' || upper === 'WAIT') return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
  return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
}

const UNKNOWN_TOKEN_SYMBOL = 'Token chưa định danh';

export function getMissingPriceReasonLabel(reason?: string | null) {
  if (reason === 'NO_TOKEN_MAPPING') return 'Thiếu mapping token';
  if (reason === 'NO_PRICE') return 'Chưa có giá token';
  return 'Chưa đủ dữ liệu giá';
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

export type ExplanationDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  value?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function ExplanationDrawer({
  children,
  description,
  footer,
  onOpenChange,
  open,
  title,
  value,
}: ExplanationDrawerProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenChange, open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      <button
        type="button"
        aria-label="Đóng phần giải thích"
        className="absolute inset-0 z-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        role="dialog"
        className="fixed inset-x-0 bottom-0 z-10 flex max-h-[85dvh] flex-col rounded-t-xl border border-white/10 bg-slate-950 shadow-2xl outline-none md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[82dvh] md:w-[min(540px,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div className="min-w-0">
            <p id={titleId} className="text-lg font-bold text-white">{title}</p>
            {value ? <div className="mt-2 text-3xl font-black text-cyan-200">{value}</div> : null}
            {description ? <div className="mt-3 text-sm leading-6 text-slate-400">{description}</div> : null}
          </div>
          <button
            type="button"
            aria-label="Đóng phần giải thích"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-white/10 p-5">
            {footer}
          </div>
        ) : null}
      </aside>
    </div>,
    document.body
  );
}

export function CountdownBadge({ value }: { value?: string | Date | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expired = isExpired(value);
  const urgent = isExpiringSoon(value, 6 * 60 * 60 * 1000);
  const className = expired
    ? 'border-slate-500/30 bg-slate-500/10 text-slate-300'
    : urgent
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
  return (
    <Badge className={className} variant="outline">
      <Clock className="h-3 w-3" />
      {formatExpiry(value, now)}
    </Badge>
  );
}

export function ProposalStatusBadge({ proposal }: { proposal: ProposalData }) {
  const backtested = Boolean(proposal.backtestedAt || proposal.winLossStatus || proposal.pnlPercentage !== null && proposal.pnlPercentage !== undefined);
  const expired = isExpired(proposal.expiresAt);
  const expiring = isExpiringSoon(proposal.expiresAt, 6 * 60 * 60 * 1000);

  if (backtested) {
    return <Badge className="border-green-500/30 bg-green-500/10 text-green-300" variant="outline">Đã kiểm chứng</Badge>;
  }

  if (expired) {
    return <Badge className="border-slate-500/30 bg-slate-500/10 text-slate-300" variant="outline">Đã hết hạn</Badge>;
  }

  if (expiring) {
    return <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300" variant="outline">Sắp hết hạn</Badge>;
  }

  return <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" variant="outline">Còn hiệu lực</Badge>;
}

export function DataQualityBadge({ value }: { value?: string | null }) {
  const missing = value === 'MISSING_PRICE';
  return (
    <Badge className={missing ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-green-500/30 bg-green-500/10 text-green-300'} variant="outline">
      {missing ? 'Chưa đủ dữ liệu giá' : 'Dữ liệu giá OK'}
    </Badge>
  );
}

export function ProposalCard({ proposal, href }: { proposal: ProposalData; href: string }) {
  const roi = normalizePercentValue(proposal.pnlPercentage ?? proposal.financialImpact?.roi);
  const risk = proposal.financialImpact?.riskLevel;
  const roiLabel = proposal.roiStatus === 'NOT_AVAILABLE' || roi === null ? 'Chưa kiểm chứng' : formatPercent(roi);
  const action = proposal.action ?? proposal.suggestionType;
  const description = proposal.summary ?? proposal.rationaleSummary ?? proposal.title;
  const backtested = Boolean(proposal.backtestedAt || proposal.winLossStatus || proposal.pnlPercentage !== null && proposal.pnlPercentage !== undefined);
  return (
    <Link href={href} className="glass-card block rounded-xl border border-white/5 bg-black/40 p-5 transition-colors hover:border-cyan-500/30 hover:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-white">{proposal.tokenSymbol ?? UNKNOWN_TOKEN_SYMBOL}</span>
            <Badge className={actionBadgeClass(action)} variant="outline">
              {toDisplayAction(action)}
            </Badge>
            <ProposalStatusBadge proposal={proposal} />
            {!backtested ? <CountdownBadge value={proposal.expiresAt} /> : null}
          </div>
          {description ? <p className="mt-2 line-clamp-2 text-sm text-slate-300">{description}</p> : null}
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Tin cậy" value={formatConfidence(proposal.confidence)} />
        <MiniStat label="Điểm tín hiệu" value={proposal.quantScore !== null && proposal.quantScore !== undefined ? formatNumber(proposal.quantScore, 2) : 'Chưa có dữ liệu'} />
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
            <span className="text-lg font-bold text-white">{signal.tokenSymbol ?? proposal?.tokenSymbol ?? UNKNOWN_TOKEN_SYMBOL}</span>
            <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" variant="outline">
              Dữ liệu định lượng
            </Badge>
            <Badge className="border-white/10 bg-black/40 text-slate-300" variant="outline">
              {toSignalLifecycleLabel(signal.lifecycleState)}
            </Badge>
            <CountdownBadge value={signal.expiresAt} />
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-slate-300">{proposal?.rationaleSummary ?? signal.rationaleSummary ?? 'Chưa có dữ liệu'}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Tin cậy" value={formatConfidence(signal.confidence)} />
        <MiniStat label="Điểm tín hiệu" value={quantScore === null || quantScore === undefined ? 'Chưa có dữ liệu' : formatNumber(quantScore, 2)} />
        <MiniStat label="Nguồn" value={signal.sources?.length ?? 0} />
        <MiniStat label="Phát hiện" value={formatRelativeVietnamese(signal.detectedAt)} />
      </div>
    </Link>
  );
}

function toSignalLifecycleLabel(value?: string | null) {
  const normalized = String(value ?? 'READY').toUpperCase();
  if (normalized.includes('EXPIRED')) return 'Đã hết hiệu lực';
  if (normalized.includes('VERIFIED') || normalized.includes('BACKTEST')) return 'Đã kiểm chứng';
  if (normalized.includes('PROPOSAL') || normalized.includes('READY') || normalized.includes('ACTIVE')) return 'Đang có tín hiệu';
  if (normalized.includes('ERROR') || normalized.includes('FAILED')) return 'Cần kiểm tra';
  return 'Đang theo dõi';
}

export function HoldingRow({ holding, totalValue }: { holding: Holding; totalValue?: number | null }) {
  const allocation = totalValue && holding.value ? (holding.value / totalValue) * 100 : null;
  const priceLabel = holding.price === null || holding.price === undefined ? 'Chưa có giá' : formatCurrency(holding.price);
  const valueLabel = holding.value === null || holding.value === undefined ? 'Chưa đủ dữ liệu giá' : formatCurrency(holding.value);
  const isUnknownToken = holding.symbol === UNKNOWN_TOKEN_SYMBOL || holding.missingReason === 'NO_TOKEN_MAPPING';
  const dataHint = holding.dataQuality === 'MISSING_PRICE'
    ? getMissingPriceReasonLabel(holding.missingReason)
    : 'Token trong Portfolio';
  return (
    <div className="grid gap-3 rounded-xl border border-white/5 bg-black/40 p-4 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-center">
      <div>
        <p className="font-bold text-white">{isUnknownToken ? UNKNOWN_TOKEN_SYMBOL : holding.symbol}</p>
        <p className="text-xs text-slate-500">{dataHint}</p>
        {holding.tokenAddress ? <p className="mt-1 truncate font-mono text-[11px] text-slate-600">{holding.tokenAddress}</p> : null}
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
