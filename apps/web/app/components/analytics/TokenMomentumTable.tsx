'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, ExternalLink } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { AnalyticsAction, SignalAnalyticsRow } from '@/lib/types/analytics';

type SortKey =
  | 'rank'
  | 'deltaRank'
  | 'signalScore'
  | 'deltaSignal'
  | 'zScore'
  | 'deltaZScore'
  | 'momentumAcceleration'
  | 'confidence'
  | 'action';

type FilterAction = 'ALL' | AnalyticsAction;

const columns: Array<{ key: SortKey | 'token' | 'sparkline' | 'sentimentShift' | 'liquidityShift' | 'uncertaintyEntropy' | 'divergence'; label: string; sortable?: boolean }> = [
  { key: 'rank', label: 'Rank', sortable: true },
  { key: 'token', label: 'Token' },
  { key: 'deltaRank', label: 'Delta Rank', sortable: true },
  { key: 'signalScore', label: 'Signal', sortable: true },
  { key: 'deltaSignal', label: 'Delta Signal', sortable: true },
  { key: 'zScore', label: 'Z', sortable: true },
  { key: 'deltaZScore', label: 'Delta Z', sortable: true },
  { key: 'momentumAcceleration', label: 'Accel', sortable: true },
  { key: 'sentimentShift', label: 'Sentiment' },
  { key: 'liquidityShift', label: 'Liquidity' },
  { key: 'uncertaintyEntropy', label: 'Unc' },
  { key: 'divergence', label: 'Divergence' },
  { key: 'confidence', label: 'Confidence', sortable: true },
  { key: 'action', label: 'Action', sortable: true },
  { key: 'sparkline', label: 'Trend' },
];

function numberCell(value: number | null | undefined, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="text-slate-600">n/a</span>;
  const tone = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-slate-400';
  return <span className={`font-mono ${tone}`}>{value > 0 ? '+' : ''}{value.toFixed(decimals)}</span>;
}

function heatClass(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'bg-slate-800/50 text-slate-500';
  if (value > 1.5) return 'bg-green-500/20 text-green-300 border-green-500/20';
  if (value > 0.3) return 'bg-green-500/10 text-green-400 border-green-500/10';
  if (value < -1.5) return 'bg-red-500/20 text-red-300 border-red-500/20';
  if (value < -0.3) return 'bg-red-500/10 text-red-400 border-red-500/10';
  return 'bg-purple-500/10 text-purple-300 border-purple-500/10';
}

function Sparkline({ values }: { values: number[] }) {
  const data = values.map((value, index) => ({ index, value }));
  const color = values[values.length - 1] >= values[0] ? '#4ade80' : '#f87171';

  if (values.length <= 1) return <span className="text-slate-600 text-xs">n/a</span>;

  return (
    <div className="h-9 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Tooltip
            contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)', color: '#e2e8f0', fontSize: 11 }}
            formatter={(value) => [Number(value).toFixed(2), 'Score']}
            labelFormatter={() => ''}
          />
          <Line type="monotone" dataKey="value" dot={false} stroke={color} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TokenMomentumTable({
  rows,
  onSelectRow,
}: {
  rows: SignalAnalyticsRow[];
  onSelectRow: (row: SignalAnalyticsRow) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('signalScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [actionFilter, setActionFilter] = useState<FilterAction>('ALL');
  const [anomalyOnly, setAnomalyOnly] = useState(false);

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => actionFilter === 'ALL' || row.action === actionFilter)
      .filter((row) => !anomalyOnly || row.divergence !== 'None')
      .sort((a, b) => {
        const aValue = a[sortKey];
        const bValue = b[sortKey];
        const direction = sortDirection === 'asc' ? 1 : -1;
        if (typeof aValue === 'string' || typeof bValue === 'string') {
          return String(aValue).localeCompare(String(bValue)) * direction;
        }
        return ((Number(aValue ?? -Infinity) || 0) - (Number(bValue ?? -Infinity) || 0)) * direction;
      });
  }, [rows, actionFilter, anomalyOnly, sortKey, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('desc');
  };

  return (
    <section className="glass-card rounded-xl border border-white/5 overflow-hidden">
      <div className="p-5 border-b border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Token Momentum Board</h2>
          <p className="text-xs text-slate-500 mt-1">Dense scan of daily signal strength, z-score pressure, and anomalies.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'BUY', 'SELL', 'HOLD'] as FilterAction[]).map((action) => (
            <button
              key={action}
              onClick={() => setActionFilter(action)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                actionFilter === action ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'bg-black/20 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {action}
            </button>
          ))}
          <button
            onClick={() => setAnomalyOnly((value) => !value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              anomalyOnly ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-black/20 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            Anomalies
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1320px] text-sm">
          <thead className="bg-black/30 border-b border-white/5">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">
                  {column.sortable ? (
                    <button className="inline-flex items-center gap-1 hover:text-slate-300" onClick={() => toggleSort(column.key as SortKey)}>
                      {column.label}
                      {sortKey === column.key ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3" />
                      )}
                    </button>
                  ) : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                <td className="px-3 py-3 font-mono text-slate-300">#{row.rank}</td>
                <td className="px-3 py-3">
                  <button onClick={() => onSelectRow(row)} className="text-left group">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white border border-white/10">
                        {row.tokenSymbol.slice(0, 2)}
                      </span>
                      <span>
                        <span className="block text-white font-bold group-hover:text-cyan-300">{row.tokenSymbol}</span>
                        <span className="block text-[10px] text-slate-500 truncate max-w-[120px]">{row.tokenName}</span>
                      </span>
                    </div>
                  </button>
                </td>
                <td className="px-3 py-3">{row.deltaRank === null ? <span className="text-slate-600">new</span> : numberCell(row.deltaRank, 0)}</td>
                <td className="px-3 py-3"><span className={`px-2 py-1 rounded-md border ${heatClass(row.signalScore)}`}>{row.signalScore.toFixed(2)}</span></td>
                <td className="px-3 py-3">{numberCell(row.deltaSignal)}</td>
                <td className="px-3 py-3">{numberCell(row.zScore)}</td>
                <td className="px-3 py-3">{numberCell(row.deltaZScore)}</td>
                <td className="px-3 py-3">{numberCell(row.momentumAcceleration)}</td>
                <td className="px-3 py-3 text-slate-300 max-w-[140px] truncate">{row.sentimentShift}</td>
                <td className="px-3 py-3">{numberCell(row.liquidityShift)}</td>
                <td className="px-3 py-3">{numberCell(row.uncertaintyEntropy)}</td>
                <td className="px-3 py-3">
                  <span className={row.divergence === 'None' ? 'text-slate-600' : 'text-amber-300'}>{row.divergence}</span>
                </td>
                <td className="px-3 py-3 font-mono text-green-300">{row.confidence}%</td>
                <td className="px-3 py-3">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                    row.action === 'BUY' ? 'bg-green-500/10 text-green-400' : row.action === 'SELL' ? 'bg-red-500/10 text-red-400' : 'bg-purple-500/10 text-purple-400'
                  }`}>
                    {row.action}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkline values={row.scoreHistory} />
                    <button onClick={() => onSelectRow(row)} className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-cyan-300" aria-label="Open explainability">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredRows.length === 0 && (
        <div className="p-10 text-center text-slate-500">
          No signals match the selected filters.
        </div>
      )}
    </section>
  );
}
