'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  TrendingUp, Eye, Loader2, ArrowUpRight, ArrowDownRight, X, ExternalLink 
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { useRouter } from 'next/navigation';

// Format Date
const formatDate = (dateString: string | Date) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit'
  });
};

// Format DateTime Detailed
const formatDateTime = (dateString: string | Date) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', { 
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit' 
  });
};

// Format Number Helper
const formatNumber = (n: number, maxDecimals = 6) => {
  if (n === undefined || n === null) return '0';
  if (Number.isInteger(n)) return n.toLocaleString();
  return parseFloat(n.toFixed(maxDecimals)).toLocaleString();
};

export function Portfolio() {
  const { publicKey } = useWallet();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // State for Modal
  const [selectedInvestment, setSelectedInvestment] = useState<any>(null);

  useEffect(() => {
    async function fetchPortfolio() {
      if (!publicKey) return;
      try {
        const res = await fetch(`/api/portfolio?wallet=${publicKey.toBase58()}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPortfolio();
  }, [publicKey]);

  if (!publicKey) {
    return <div className="p-10 text-center text-slate-500">Please connect wallet.</div>;
  }

  if (loading) {
    return (
      <div className="p-20 flex justify-center">
        <Loader2 className="animate-spin text-purple-500" />
      </div>
    );
  }

  const { holdings = [], investments = [], watchlist = [], stats } = data || {};

  return (
    <div className="space-y-8 animate-in fade-in relative">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold gradient-text">My Portfolio</h1>
        <div className="text-right">
          <p className="text-sm text-slate-400">Total Net Worth</p>
          <p className="text-2xl font-bold text-white">
            ${stats?.totalValue?.toLocaleString() || '0'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="holdings" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-900/50">
          <TabsTrigger value="holdings">Wallet Holdings ({holdings.length})</TabsTrigger>
          <TabsTrigger value="investments">Investments ({investments.length})</TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist ({watchlist.length})</TabsTrigger>
        </TabsList>

        {/* 1. WALLET HOLDINGS */}
        <TabsContent value="holdings" className="mt-6 space-y-4">
          {holdings.length === 0 ? (
            <div className="p-8 text-center glass-card border-dashed border-slate-700">
               <p className="text-slate-500">No assets found in wallet.</p>
               <p className="text-xs text-slate-600 mt-1">Try syncing your wallet above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {holdings.map((h: any, i: number) => (
                <div key={i} className="glass-card p-4 rounded-xl flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white">
                      {h.symbol[0]}
                    </div>
                    <div>
                      <p className="font-bold text-white">{h.symbol}</p>
                      <p className="text-xs text-slate-400">
                        {formatNumber(h.balance)} Tokens
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-400">
                      ${formatNumber(h.value, 2)}
                    </p>
                    <p className="text-xs text-slate-500">
                      ${formatNumber(h.price, 2)}/each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 2. INVESTMENTS */}
        <TabsContent value="investments" className="mt-6">
          {investments.length === 0 ? (
            <div className="p-8 text-center glass-card border-dashed border-slate-700">
               <p className="text-slate-500">No active investments.</p>
               <p className="text-xs text-slate-600 mt-1">Execute a trade from a proposal to see it here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {investments.map((inv: any) => (
                <div
                  key={inv._id}
                  onClick={() => setSelectedInvestment(inv)}
                  className="glass-card p-4 rounded-xl border-l-4 border-green-500 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-all group"
                >
                  <div className="flex items-center gap-4">
                     <div className={`p-3 rounded-full ${inv.direction === 'SHORT' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                        {inv.direction === 'SHORT' ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                     </div>
                     <div>
                        <h3 className="font-bold text-white flex items-center gap-2">
                          {inv.symbol} <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300">{inv.leverage}x</span>
                        </h3>
                        <p className="text-xs text-slate-400">Entry: ${formatNumber(inv.entryPrice, 2)}</p>
                     </div>
                  </div>
                  <div className="text-right group-hover:translate-x-[-10px] transition-transform">
                    <p className="text-lg font-bold text-white">
                      ${formatNumber(inv.size)}
                    </p>
                    <p className="text-xs text-green-400">Active • View Details</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 3. WATCHLIST */}
        <TabsContent value="watchlist" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {watchlist.map((w: any) => (
              <div
                key={w._id}
                onClick={() => router.push(`/proposal/${w._id}`)}
                className="glass-card p-4 rounded-xl border border-dashed border-slate-700 hover:border-purple-500/50 transition-colors cursor-pointer"
              >
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-purple-400">{w.tokenSymbol}</span>
                  <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">
                    {formatDate(w.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-slate-300 line-clamp-1 mb-3">
                  {w.title}
                </p>
                <div className="flex gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1">
                    <TrendingUp size={12} className="text-green-400" />
                    ROI: {formatNumber(w.roi)}%
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye size={12} className="text-blue-400" />
                    Conf: {formatNumber(w.confidence)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* --- MODAL DETAIL INVESTMENT --- */}
      {selectedInvestment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-white/10 relative shadow-2xl shadow-purple-900/20 scale-100 animate-in zoom-in-95 duration-200">
            
            {/* Close Button */}
            <button 
              onClick={() => setSelectedInvestment(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/50 mb-4 border border-white/5">
                 <span className="text-2xl font-bold text-white">{selectedInvestment.symbol ? selectedInvestment.symbol[0] : '?'}</span>
              </div>
              <h2 className="text-2xl font-bold text-white">{selectedInvestment.symbol} Position</h2>
              <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold mt-2 ${selectedInvestment.direction === 'SHORT' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                 {selectedInvestment.direction} {selectedInvestment.leverage}x
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Entry Price</p>
                <p className="font-mono font-bold text-white">${formatNumber(selectedInvestment.entryPrice, 2)}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Position Size</p>
                <p className="font-mono font-bold text-white">${formatNumber(selectedInvestment.size)}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Entry Time</p>
                <p className="font-mono text-xs text-white">{formatDateTime(selectedInvestment.createdAt)}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-green-500/30">
                <p className="text-xs text-green-400 mb-1">Est. PnL (Sim)</p>
                <p className="font-mono font-bold text-green-400">+0.00%</p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="space-y-3">
              {selectedInvestment.proposalId && (
                <button 
                  onClick={() => router.push(`/proposal/${selectedInvestment.proposalId}`)}
                  className="w-full py-3 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <ExternalLink size={16} /> View Original Proposal
                </button>
              )}
              
              <button 
                className="w-full py-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold border border-red-500/30 transition-colors"
                onClick={() => alert("Close Position feature coming soon!")}
              >
                Close Position
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}