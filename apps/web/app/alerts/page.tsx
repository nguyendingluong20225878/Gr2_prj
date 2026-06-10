'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Bell, Clock, Database, ShieldAlert } from 'lucide-react';
import { Layout } from '@/app/components/layout/Layout';
import { Button } from '@/app/components/ui/button';
import { DataSkeleton, EmptyState, getMissingPriceReasonLabel, PageHeader } from '@/app/components/shared/NdlUi';
import { useNdlData } from '@/lib/hooks/useNdlData';
import { getHoldingSymbolSet } from '@/lib/utils/proposals';
import { formatExpiry, isExpiringSoon } from '@/lib/utils/time';

type AlertLevel = 'critical' | 'warning' | 'info';

type AlertItem = {
  id: string;
  title: string;
  tokenSymbol?: string;
  type: 'ENTRY_ZONE' | 'SIGNAL_EXPIRING' | 'RISK' | 'PROPOSAL_EXPIRING' | 'DATA';
  level: AlertLevel;
  href: string;
  ctaLabel: string;
  expiresAt?: string;
  detail?: string;
};

export default function AlertsPage() {
  const { portfolio, proposals, signals } = useNdlData();

  const alerts = useMemo<AlertItem[]>(() => {
    const heldSymbols = getHoldingSymbolSet(portfolio.data?.holdings ?? []);
    const signalAlerts = (signals.data ?? [])
      .filter((signal) => isExpiringSoon(signal.expiresAt, 6 * 60 * 60 * 1000))
      .map((signal) => ({
        id: `signal-${signal._id}`,
        title: `Signal ${signal.tokenSymbol ?? 'Token chưa định danh'} sắp hết hạn`,
        tokenSymbol: signal.tokenSymbol,
        type: 'SIGNAL_EXPIRING' as const,
        level: 'critical' as const,
        href: `/signals/${signal._id}`,
        ctaLabel: 'Xem signal',
        expiresAt: signal.expiresAt,
      }));

    const proposalAlerts = (proposals.data ?? [])
      .filter((proposal) => isExpiringSoon(proposal.expiresAt, 6 * 60 * 60 * 1000))
      .map((proposal) => ({
        id: `proposal-${proposal._id}`,
        title: `Khuyến nghị ${proposal.tokenSymbol ?? 'Token chưa định danh'} sắp hết hạn`,
        tokenSymbol: proposal.tokenSymbol,
        type: 'PROPOSAL_EXPIRING' as const,
        level: 'critical' as const,
        href: `/proposal/${proposal._id}`,
        ctaLabel: 'Xem proposal',
        expiresAt: proposal.expiresAt,
      }));

    const riskAlerts = (proposals.data ?? [])
      .filter((proposal) => String(proposal.financialImpact?.riskLevel ?? '').toUpperCase() === 'HIGH')
      .map((proposal) => ({
        id: `risk-${proposal._id}`,
        title: `${proposal.tokenSymbol ?? 'Token chưa định danh'} có rủi ro cao`,
        tokenSymbol: proposal.tokenSymbol,
        type: 'RISK' as const,
        level: heldSymbols.has(String(proposal.tokenSymbol ?? '').toUpperCase()) ? 'critical' as const : 'warning' as const,
        href: '/recommendations',
        ctaLabel: 'Xem khuyến nghị',
        expiresAt: proposal.expiresAt,
      }));

    const dataAlerts = (portfolio.data?.holdings ?? [])
      .filter((holding) => holding.dataQuality === 'MISSING_PRICE')
      .map((holding) => ({
        id: `data-${holding.symbol}`,
        title: `${holding.symbol} ${getMissingPriceReasonLabel(holding.missingReason).toLowerCase()}`,
        tokenSymbol: holding.symbol,
        type: 'DATA' as const,
        level: 'warning' as const,
        href: '/data-check',
        ctaLabel: 'Kiểm tra dữ liệu',
        detail: getMissingPriceReasonLabel(holding.missingReason),
      }));

    return dedupeAlertsByToken([...proposalAlerts, ...signalAlerts, ...riskAlerts, ...dataAlerts]);
  }, [portfolio.data?.holdings, proposals.data, signals.data]);
  const groupedAlerts = {
    critical: alerts.filter((alert) => alert.level === 'critical'),
    warning: alerts.filter((alert) => alert.level === 'warning'),
    info: alerts.filter((alert) => alert.level === 'info'),
  };

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Cảnh báo"
          title="Có gì cần chú ý ngay?"
          description="Cảnh báo được ưu tiên theo mức độ khẩn cấp để bạn không bị nhiễu bởi quá nhiều notification."
        />

        {portfolio.isLoading || proposals.isLoading || signals.isLoading ? (
          <DataSkeleton rows={4} />
        ) : (
          <section className="space-y-4">
            <AlertGroup title="Critical" alerts={groupedAlerts.critical} empty="Không có cảnh báo cần xử lý ngay." />
            <AlertGroup title="Warning" alerts={groupedAlerts.warning} empty="Không có cảnh báo dữ liệu/rủi ro." />
            <AlertGroup title="Info" alerts={groupedAlerts.info} empty="Không có thông tin mới." />
            {!alerts.length ? <EmptyState title="Không có cảnh báo" description="Không phát hiện entry zone, Signal sắp hết hạn hoặc dữ liệu thiếu." /> : null}
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300"><Link href="/watchlist">Mở danh sách theo dõi</Link></Button>
          <Button asChild variant="outline" className="border-white/10"><Link href="/data-check">Kiểm tra dữ liệu</Link></Button>
        </div>
      </div>
    </Layout>
  );
}

function AlertGroup({ title, alerts, empty }: { title: string; alerts: AlertItem[]; empty: string }) {
  if (!alerts.length) {
    return (
      <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      </section>
    );
  }

  return (
    <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {alerts.map((alert) => (
          <Link key={alert.id} href={alert.href} className="block rounded-xl border border-white/5 bg-black/40 p-4 hover:border-cyan-500/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {iconFor(alert.type)}
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{labelFor(alert.type)}</span>
                </div>
                <h3 className="mt-3 font-bold text-white">{alert.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{alert.detail ?? alert.tokenSymbol ?? 'Chưa có token liên kết'}</p>
              </div>
              <span className="text-sm font-bold text-cyan-300">{alert.ctaLabel}</span>
            </div>
            {alert.expiresAt ? <p className="mt-3 text-sm text-amber-300">{formatExpiry(alert.expiresAt)}</p> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}

function dedupeAlertsByToken(alerts: AlertItem[]) {
  const priority: Record<AlertLevel, number> = { critical: 3, warning: 2, info: 1 };
  const byToken = new Map<string, AlertItem>();

  alerts.forEach((alert) => {
    const key = String(alert.tokenSymbol ?? alert.id).toUpperCase();
    const current = byToken.get(key);
    if (!current || priority[alert.level] > priority[current.level]) {
      byToken.set(key, alert);
    }
  });

  return [...byToken.values()].sort((a, b) => priority[b.level] - priority[a.level]);
}

function iconFor(type: AlertItem['type']) {
  if (type === 'ENTRY_ZONE') return <Bell className="h-4 w-4 text-cyan-300" />;
  if (type === 'SIGNAL_EXPIRING' || type === 'PROPOSAL_EXPIRING') return <Clock className="h-4 w-4 text-amber-300" />;
  if (type === 'DATA') return <Database className="h-4 w-4 text-purple-300" />;
  return <ShieldAlert className="h-4 w-4 text-red-300" />;
}

function labelFor(type: AlertItem['type']) {
  if (type === 'ENTRY_ZONE') return 'Entry zone';
  if (type === 'SIGNAL_EXPIRING') return 'Signal sắp hết hạn';
  if (type === 'PROPOSAL_EXPIRING') return 'Khuyến nghị sắp hết hạn';
  if (type === 'DATA') return 'Dữ liệu giá';
  return 'Risk alert';
}
