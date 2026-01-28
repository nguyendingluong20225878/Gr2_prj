'use client';

import { TrendingUp, History, Wallet } from 'lucide-react';

// MOCK DATA
const mockStats = { totalPnL: 1250.50, winRate: 68, totalTrades: 12 };
const mockTrades = [
  { _id: '1', tokenSymbol: 'SOL', action: 'BUY', amount: 500, status: 'CLOSED', entryPrice: 98.5, executedAt: '2024-03-20' },
  { _id: '2', tokenSymbol: 'JUP', action: 'SELL', amount: 200, status: 'CLOSED', entryPrice: 1.2, executedAt: '2024-03-19' },
  { _id: '3', tokenSymbol: 'BONK', action: 'HOLD', amount: 100, status: 'OPEN', entryPrice: 0.000015, executedAt: '2024-03-18' },
];

export function Portfolio() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold gradient-text">My Portfolio (Mock)</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-xl border border-cyan-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={40} /></div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Total PnL</p>
          <h2 className="text-4xl font-bold mt-2 text-green-400">${mockStats.totalPnL.toFixed(2)}</h2>
        </div>
        <div className="glass-card p-6 rounded-xl border border-purple-500/20">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Win Rate</p>
          <h2 className="text-4xl font-bold mt-2 text-white">{mockStats.winRate}%</h2>
        </div>
        <div className="glass-card p-6 rounded-xl border border-white/10">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Total Trades</p>
          <h2 className="text-4xl font-bold mt-2 text-white">{mockStats.totalTrades}</h2>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-card rounded-xl overflow-hidden border border-white/5">
        <div className="p-6 border-b border-white/5 flex items-center gap-2 bg-white/5">
          <History size={18} className="text-cyan-400" />
          <h3 className="font-bold text-white">Recent Activities</h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead className="bg-black/20 text-[10px] uppercase font-bold text-slate-500">
            <tr>
              <th className="p-4">Token</th><th className="p-4">Action</th><th className="p-4">Amount</th><th className="p-4">Status</th><th className="p-4">Price</th><th className="p-4">Date</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-white/5">
            {mockTrades.map((trade: any) => (
              <tr key={trade._id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 font-bold text-white">{trade.tokenSymbol}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${trade.action === 'BUY' ? 'bg-green-500/10 text-green-400' : trade.action === 'SELL' ? 'bg-red-500/10 text-red-400' : 'bg-purple-500/10 text-purple-400'}`}>{trade.action}</span>
                </td>
                <td className="p-4 font-mono text-slate-300">${trade.amount}</td>
                <td className="p-4 text-xs font-semibold text-slate-400">{trade.status}</td>
                <td className="p-4 font-mono text-slate-300">${trade.entryPrice}</td>
                <td className="p-4 text-slate-500 text-xs">{trade.executedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}