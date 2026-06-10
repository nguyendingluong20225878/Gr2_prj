'use client';

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils/formatters';
import { formatVietnameseDateTime } from '@/lib/utils/time';
import type { ProposalTimelineData, ProposalTimelineMarker } from '@/lib/hooks/useNdlData';

type ChartPoint = {
  time: number;
  price: number;
};

type MarkerPoint = ChartPoint & {
  marker: ProposalTimelineMarker;
  matchedTime: number | null;
  priceGapMs: number | null;
};

type VerificationRow = {
  marker: ProposalTimelineMarker;
  time: number;
  price: number | null;
  matchedTime?: number;
  plotted: boolean;
};

type BacktestSummary = {
  averageRoi: number | null;
  coverageLabel: string;
  similarCount: number;
  winRate: number | null;
};

const ACTION_COLOR: Record<string, string> = {
  BUY: '#22c55e',
  SELL: '#ef4444',
  HOLD: '#a855f7',
};

function nearestPrice(time: number, prices: ChartPoint[]) {
  if (!prices.length) return null;
  return prices.reduce((best, point) => (
    Math.abs(point.time - time) < Math.abs(best.time - time) ? point : best
  ), prices[0]);
}

function getTimelineMarkers(timeline: ProposalTimelineData) {
  return [
    ...timeline.historicalProposals,
    ...(timeline.currentProposal ? [timeline.currentProposal] : []),
  ];
}

function buildMaxMarkerGapMs(prices: ChartPoint[]) {
  const sortedTimes = prices
    .map((point) => point.time)
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);

  const gaps = sortedTimes
    .slice(1)
    .map((time, index) => time - sortedTimes[index])
    .filter((gap) => gap > 0);

  if (!gaps.length) return 60 * 60 * 1000;
  const median = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  return Math.max(median * 2.5, 60 * 60 * 1000);
}

function buildMarkerPoints(timeline: ProposalTimelineData, prices: ChartPoint[]): MarkerPoint[] {
  const markers = getTimelineMarkers(timeline);
  const maxGapMs = buildMaxMarkerGapMs(prices);
  const minPriceTime = Math.min(...prices.map((point) => point.time));
  const maxPriceTime = Math.max(...prices.map((point) => point.time));

  return markers
    .map((marker): MarkerPoint | null => {
      const time = marker.date ? new Date(marker.date).getTime() : NaN;
      if (marker.priceStatus) {
        const matchedTime = marker.matchedPriceAt ? new Date(marker.matchedPriceAt).getTime() : null;
        return Number.isFinite(time) &&
          marker.markerPrice !== null &&
          marker.markerPrice !== undefined &&
          Number.isFinite(Number(marker.markerPrice))
          ? {
              time,
              price: Number(marker.markerPrice),
              marker,
              matchedTime: matchedTime && Number.isFinite(matchedTime) ? matchedTime : null,
              priceGapMs: marker.priceGapMs ?? null,
            }
          : null;
      }

      // TODO: Remove this compatibility fallback after timeline API always returns per-marker priceStatus.
      if (!Number.isFinite(time) || time < minPriceTime || time > maxPriceTime) return null;

      const nearest = nearestPrice(time, prices);
      if (!nearest) return null;

      const priceGapMs = Math.abs(nearest.time - time);
      if (priceGapMs > maxGapMs) return null;

      return { time, price: nearest.price, marker, matchedTime: nearest.time, priceGapMs };
    })
    .filter((point): point is MarkerPoint => Boolean(point));
}

function buildVerificationRows(timeline: ProposalTimelineData, markerPoints: MarkerPoint[]): VerificationRow[] {
  const plottedById = new Map(markerPoints.map((point) => [point.marker.id, point]));

  return getTimelineMarkers(timeline)
    .map((marker) => {
      const time = marker.date ? new Date(marker.date).getTime() : NaN;
      const plotted = plottedById.get(marker.id);
      return {
        marker,
        time,
        price: plotted?.price ?? marker.markerPrice ?? null,
        matchedTime: plotted?.matchedTime ?? (marker.matchedPriceAt ? new Date(marker.matchedPriceAt).getTime() : undefined),
        plotted: Boolean(plotted),
      };
    })
    .filter((row) => Number.isFinite(row.time));
}

function buildZoomedDomain(points: ChartPoint[]): [number, number] {
  const values = points.map((point) => point.price).filter((value) => Number.isFinite(value));
  if (!values.length) return [0, 1];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const mid = (min + max) / 2;
  const pad = range > 0
    ? Math.max(range * 0.25, Math.abs(mid) * 0.001, 0.02)
    : Math.max(Math.abs(mid) * 0.002, 0.05);

  return [min - pad, max + pad];
}

function buildTimeDomain(points: ChartPoint[]): [number, number] | ['dataMin', 'dataMax'] {
  const values = points.map((point) => point.time).filter((value) => Number.isFinite(value));
  if (!values.length) return ['dataMin', 'dataMax'];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const oneDay = 24 * 60 * 60 * 1000;
    return [min - oneDay, max + oneDay];
  }
  return [min, max];
}

function MarkerShape(props: any) {
  const marker = props.payload?.marker as ProposalTimelineMarker | undefined;
  const action = String(marker?.action ?? 'HOLD').toUpperCase();
  const color = ACTION_COLOR[action] ?? ACTION_COLOR.HOLD;
  const radius = marker?.isCurrent ? 7 : 5;
  const limited = Boolean(marker?.priceStatus && marker.priceStatus !== 'MATCHED');
  const resultStroke = marker?.result === 'Win'
    ? '#22c55e'
    : marker?.result === 'Loss'
      ? '#ef4444'
      : marker?.result === 'Breakeven'
        ? '#f59e0b'
        : marker?.isCurrent
          ? '#ffffff'
          : '#0f172a';

  return (
    <circle
      cx={props.cx}
      cy={props.cy}
      r={radius}
      fill={color}
      opacity={limited ? 0.45 : 1}
      stroke={resultStroke}
      strokeDasharray={limited ? '3 2' : undefined}
      strokeWidth={marker?.isCurrent ? 2.5 : 1.5}
    />
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const markerPoint = payload.find((item) => item.payload?.marker)?.payload as MarkerPoint | undefined;
  const linePoint = payload.find((item) => item.payload?.price)?.payload as ChartPoint | undefined;
  const marker = markerPoint?.marker;

  return (
    <div className="max-w-xs rounded-lg border border-white/10 bg-slate-950/95 p-3 text-sm text-slate-100 shadow-xl">
      {marker ? (
        <>
          <p className="font-semibold text-white">{formatVietnameseDateTime(marker.date)}</p>
          <p className="mt-1">{marker.action} khuyến nghị {marker.isCurrent ? '(hiện tại)' : ''}</p>
          <div className="mt-2 space-y-1 text-xs text-slate-300">
            <p>Giá: {formatCurrency(markerPoint?.price, 3)}</p>
            {markerPoint?.matchedTime ? <p>Giá khớp gần nhất: {formatVietnameseDateTime(new Date(markerPoint.matchedTime))}</p> : null}
            <p>Tin cậy: {marker.confidence === null || marker.confidence === undefined ? 'Chưa có dữ liệu' : `${marker.confidence}%`}</p>
            <p>Điểm tín hiệu: {formatNumber(marker.quant, 2)}</p>
            <p>Kiểm chứng: {marker.pnlPercentage === null || marker.pnlPercentage === undefined ? 'Đang chờ' : formatPercent(marker.pnlPercentage)}</p>
            <p>Kết quả: {marker.result}</p>
            <p>Giá vào: {formatCurrency(marker.entryPrice)}</p>
            <p>Giá ra: {formatCurrency(marker.exitPrice)}</p>
            <p>Hết hiệu lực: {formatVietnameseDateTime(marker.expirationTime)}</p>
          </div>
        </>
      ) : (
        <>
          <p className="font-semibold text-white">{linePoint?.time ? formatVietnameseDateTime(new Date(linePoint.time)) : 'Chưa có dữ liệu'}</p>
          <p className="mt-1 text-xs text-slate-300">Giá: {formatCurrency(linePoint?.price, 3)}</p>
          <p className="mt-1 text-xs text-slate-300">Tín hiệu: Không có</p>
        </>
      )}
    </div>
  );
}

export default function ProposalAccuracyChart({ timeline }: { timeline: ProposalTimelineData }) {
  const pricePoints = timeline.priceHistory
    .map((point) => ({ time: new Date(point.timestamp).getTime(), price: Number(point.price) }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.price));
  const markerPoints = buildMarkerPoints(timeline, pricePoints);
  const verificationRows = buildVerificationRows(timeline, markerPoints);
  const yDomain = buildZoomedDomain(pricePoints);
  const xDomain = buildTimeDomain(pricePoints);
  const unplottedCount = verificationRows.filter((row) => !row.plotted).length;
  const canDrawLine = pricePoints.length >= 2;
  const summary = buildBacktestSummary(timeline);
  const dataWarnings = buildTimelineWarnings(timeline, pricePoints.length, unplottedCount);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Số khuyến nghị tương tự" value={formatNumber(summary.similarCount, 0)} />
        <SummaryCard label="Win-rate" value={summary.winRate === null ? 'Chưa đủ dữ liệu' : formatPercent(summary.winRate)} />
        <SummaryCard label="ROI trung bình" value={summary.averageRoi === null ? 'Chưa đủ dữ liệu' : formatPercent(summary.averageRoi)} />
        <SummaryCard label="Dữ liệu giá" value={summary.coverageLabel} />
      </div>
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">
        Kết quả kiểm chứng là dữ liệu tham khảo, không đảm bảo kết quả tương lai.
      </div>
      {dataWarnings.length ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
          <p className="font-semibold">Chất lượng dữ liệu cần chú ý</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {dataWarnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}
      <div className="h-80">
        {canDrawLine ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={pricePoints} margin={{ left: 8, right: 16, top: 12, bottom: 8 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis
                dataKey="time"
                type="number"
                domain={xDomain}
                stroke="#64748b"
                tickFormatter={(value) => new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
              />
              <YAxis
                domain={yDomain}
                allowDataOverflow={false}
                stroke="#64748b"
                tickFormatter={(value) => `$${formatNumber(value, 3)}`}
                width={72}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(34,211,238,0.25)' }} />
              <Line
                type="monotone"
                dataKey="price"
                name="Token price"
                stroke="#22d3ee"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 1 }}
                connectNulls={false}
              />
              {markerPoints.length ? <Scatter data={markerPoints} dataKey="price" shape={<MarkerShape />} /> : null}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 text-sm text-slate-400">
            Chưa có đủ lịch sử giá để dựng đường kiểm chứng.
          </div>
        )}
      </div>
      {unplottedCount > 0 ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
          Có {unplottedCount} khuyến nghị không được vẽ lên biểu đồ vì thiếu giá quanh thời điểm tạo hoặc nằm ngoài vùng giá. Bảng bên dưới vẫn giữ các dòng này để kiểm tra lại, nhưng không gắn điểm lên đường giá.
        </div>
      ) : null}
      <VerificationTable rows={verificationRows} />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function buildBacktestSummary(timeline: ProposalTimelineData): BacktestSummary {
  const resolved = timeline.backtestResults.filter((result) => result.result !== 'Pending');
  const wins = resolved.filter((result) => result.result === 'Win').length;
  const pnlValues = timeline.backtestResults
    .map((result) => result.pnlPercentage)
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(Number(value)));
  const pointCount = timeline.priceCoverage?.pointCount ?? timeline.priceHistory.length;

  return {
    averageRoi: pnlValues.length ? pnlValues.reduce((sum, value) => sum + value, 0) / pnlValues.length : null,
    coverageLabel: pointCount ? `${formatNumber(pointCount, 0)} điểm giá` : 'Chưa có lịch sử giá',
    similarCount: timeline.historicalProposals.length || timeline.backtestResults.length,
    winRate: resolved.length ? (wins / resolved.length) * 100 : null,
  };
}

function buildTimelineWarnings(timeline: ProposalTimelineData, plottedPriceCount: number, unplottedCount: number) {
  const warnings = new Set<string>();
  const pointCount = timeline.priceCoverage?.pointCount ?? plottedPriceCount;

  timeline.missingData.forEach((item) => warnings.add(readableMissingTimelineData(item)));
  if (!timeline.priceHistory.length) warnings.add('Chưa có lịch sử giá để dựng đường giá token.');
  if (pointCount > 0 && pointCount < 20) warnings.add(`Dữ liệu giá còn mỏng: chỉ có ${formatNumber(pointCount, 0)} điểm giá.`);
  if (unplottedCount > 0) warnings.add(`${unplottedCount} marker không được vẽ do thiếu giá quanh thời điểm tạo hoặc nằm ngoài vùng giá.`);

  return Array.from(warnings);
}

function readableMissingTimelineData(value: string) {
  const text = value.toLowerCase();
  if (text.includes('pricehistory') || text.includes('price_history')) return 'Thiếu lịch sử giá token.';
  if (text.includes('marker')) return 'Thiếu dữ liệu khớp marker với giá.';
  if (text.includes('price')) return 'Thiếu dữ liệu giá quanh thời điểm kiểm chứng.';
  return value;
}

function VerificationTable({ rows: inputRows }: { rows: VerificationRow[] }) {
  const rows = [...inputRows]
    .sort((a, b) => b.time - a.time)
    .slice(0, 8);

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
        Chưa có khuyến nghị lịch sử để lập bảng kiểm chứng.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/5 bg-black/30">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[1.1fr_0.7fr_0.8fr_0.8fr_0.8fr_0.9fr] gap-3 border-b border-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <span>Thời điểm</span>
          <span>Hành động</span>
          <span>Kết quả</span>
          <span>PnL</span>
          <span>Tin cậy</span>
          <span>Giá</span>
        </div>
        {rows.map(({ marker, price, plotted }) => (
          <div key={marker.id} className="grid grid-cols-[1.1fr_0.7fr_0.8fr_0.8fr_0.8fr_0.9fr] gap-3 border-b border-white/5 px-4 py-3 text-sm text-slate-300 last:border-b-0">
            <span className="text-slate-400">{formatVietnameseDateTime(marker.date)}</span>
            <span className="font-semibold" style={{ color: ACTION_COLOR[String(marker.action).toUpperCase()] ?? ACTION_COLOR.HOLD }}>
              {marker.action}
            </span>
            <span className={resultClass(marker.result)}>{toVietnameseResult(marker.result)}</span>
            <span>{marker.pnlPercentage === null || marker.pnlPercentage === undefined ? 'Chưa kiểm chứng' : formatPercent(marker.pnlPercentage)}</span>
            <span>{marker.confidence === null || marker.confidence === undefined ? 'Chưa có dữ liệu' : `${marker.confidence}%`}</span>
            <span>{plotted && price !== null ? formatCurrency(price, 3) : getPriceStatusLabel(marker.priceStatus)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getPriceStatusLabel(status?: ProposalTimelineMarker['priceStatus']) {
  if (status === 'NO_PRICE_HISTORY') return 'Chưa có lịch sử giá';
  if (status === 'OUT_OF_RANGE') return 'Ngoài vùng giá';
  if (status === 'PRICE_GAP_TOO_LARGE') return 'Thiếu giá quanh thời điểm';
  return 'Thiếu giá quanh thời điểm';
}

function toVietnameseResult(result: ProposalTimelineMarker['result']) {
  if (result === 'Win') return 'Win';
  if (result === 'Loss') return 'Loss';
  if (result === 'Breakeven') return 'Hòa vốn';
  return 'Chưa kiểm chứng';
}

function resultClass(result: ProposalTimelineMarker['result']) {
  if (result === 'Win') return 'font-semibold text-green-300';
  if (result === 'Loss') return 'font-semibold text-red-300';
  if (result === 'Breakeven') return 'font-semibold text-amber-300';
  return 'text-slate-400';
}
