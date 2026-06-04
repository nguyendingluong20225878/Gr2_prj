'use client';

import {
  Brush,
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
  ), prices[0]).price;
}

function buildMarkerPoints(timeline: ProposalTimelineData): MarkerPoint[] {
  const prices = timeline.priceHistory
    .map((point) => ({ time: new Date(point.timestamp).getTime(), price: Number(point.price) }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.price));

  const markers = [
    ...timeline.historicalProposals,
    ...(timeline.currentProposal ? [timeline.currentProposal] : []),
  ];

  return markers
    .map((marker) => {
      const time = marker.date ? new Date(marker.date).getTime() : NaN;
      const price = Number(nearestPrice(time, prices));
      return Number.isFinite(time) && Number.isFinite(price) ? { time, price, marker } : null;
    })
    .filter((point): point is MarkerPoint => Boolean(point));
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

  return (
    <circle
      cx={props.cx}
      cy={props.cy}
      r={radius}
      fill={color}
      stroke={marker?.isCurrent ? '#ffffff' : '#0f172a'}
      strokeWidth={marker?.isCurrent ? 2 : 1}
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
          <p className="mt-1">{marker.action} proposal {marker.isCurrent ? '(hiện tại)' : ''}</p>
          <div className="mt-2 space-y-1 text-xs text-slate-300">
            <p>Price: {formatCurrency(markerPoint?.price, 3)}</p>
            <p>Confidence: {marker.confidence === null || marker.confidence === undefined ? 'N/A' : `${marker.confidence}%`}</p>
            <p>Quant: {formatNumber(marker.quant, 2)}</p>
            <p>Backtest: {marker.pnlPercentage === null || marker.pnlPercentage === undefined ? 'Pending' : formatPercent(marker.pnlPercentage)}</p>
            <p>Result: {marker.result}</p>
            <p>Entry: {formatCurrency(marker.entryPrice)}</p>
            <p>Exit: {formatCurrency(marker.exitPrice)}</p>
            <p>Expires: {formatVietnameseDateTime(marker.expirationTime)}</p>
          </div>
        </>
      ) : (
        <>
          <p className="font-semibold text-white">{linePoint?.time ? formatVietnameseDateTime(new Date(linePoint.time)) : 'N/A'}</p>
          <p className="mt-1 text-xs text-slate-300">Price: {formatCurrency(linePoint?.price, 3)}</p>
          <p className="mt-1 text-xs text-slate-300">Signal: Không có</p>
        </>
      )}
    </div>
  );
}

export default function ProposalAccuracyChart({ timeline }: { timeline: ProposalTimelineData }) {
  const pricePoints = timeline.priceHistory
    .map((point) => ({ time: new Date(point.timestamp).getTime(), price: Number(point.price) }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.price));
  const markerPoints = buildMarkerPoints(timeline);
  const yDomain = buildZoomedDomain(pricePoints);
  const xDomain = buildTimeDomain(pricePoints);

  if (pricePoints.length < 2) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 text-sm text-slate-400">
        Chưa có đủ price history để dựng đường giá backtest.
      </div>
    );
  }

  return (
    <div className="h-96">
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
          <Scatter data={markerPoints} dataKey="price" shape={<MarkerShape />} />
          {pricePoints.length > 40 ? (
            <Brush
              dataKey="time"
              height={24}
              travellerWidth={8}
              stroke="rgba(34,211,238,0.5)"
              fill="rgba(15,23,42,0.85)"
              tickFormatter={(value) => new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
