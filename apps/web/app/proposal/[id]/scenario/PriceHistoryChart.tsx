'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber } from '@/lib/utils/formatters';

type PricePoint = {
  timestamp: string;
  price: number;
  source?: string;
};

export default function PriceHistoryChart({ history }: { history: PricePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={history}>
        <XAxis
          dataKey="timestamp"
          stroke="#64748b"
          tickFormatter={(value) => new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        />
        <YAxis stroke="#64748b" tickFormatter={(value) => `$${formatNumber(value, 1)}`} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
        <Line type="monotone" dataKey="price" stroke="#22d3ee" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
