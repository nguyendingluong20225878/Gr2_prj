'use client';

import { useState } from 'react';
import { useSignals } from '@/lib/hooks/useSignals';
import { ProposalCardSocial } from './SignalCardSocial'; 
import { Sparkles, TrendingUp, AlertCircle, Activity, ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';

// 1. Định nghĩa Interface cho Props của Dashboard
interface DashboardProps {
  onViewProposal?: (proposalId: string) => void;
}

// Helper: Rút gọn địa chỉ ví (Ví dụ: JUP...7s9a)
const shortenAddress = (addr: string) => {
  if (!addr) return 'Unknown';
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
};

// Helper: Đoán tên Token từ địa chỉ (Mapping tạm thời cho đẹp giao diện)
const getTokenSymbol = (addr: string) => {
  if (!addr) return 'TOKEN';
  if (addr.startsWith('So111')) return 'SOL';
  if (addr.startsWith('JUP')) return 'JUP';
  if (addr.startsWith('EPj')) return 'USDC';
  if (addr.startsWith('Dez')) return 'BONK';
  return 'SOL-TOKEN'; 
};

// 2. Component Dashboard Chính
// Sửa lỗi: Destructuring { onViewProposal } ngay tại tham số hàm
export function Dashboard({ onViewProposal }: DashboardProps = {}) {
  // Sử dụng hook lấy Signals từ database
  const { signals, loading, error } = useSignals();
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');

  // 3. MAPPING DỮ LIỆU: Chuyển đổi từ Signal (DB) -> UI Props (Card)
  // Logic này giúp tái sử dụng ProposalCardSocial cũ mà không cần sửa code của Card
  const mappedProposals = signals.map((s) => {
    // Xác định hành động (Buy/Sell) dựa trên suggestionType
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    const type = s.suggestionType?.toLowerCase();
    
    if (type === 'buy' || type === 'stake') action = 'BUY';
    else if (type === 'sell' || type === 'close_position') action = 'SELL';

    // Xử lý độ tin cậy (Nếu DB lưu 0.85 -> UI hiển thị 85)
    const confidencePercent = s.confidence <= 1 ? Math.round(s.confidence * 100) : s.confidence;

    return {
      _id: s._id,
      tokenSymbol: getTokenSymbol(s.tokenAddress),
      tokenName: shortenAddress(s.tokenAddress),
      
      action: action,
      
      title: `${s.sentimentType.toUpperCase()} Signal Detected`,
      summary: s.rationaleSummary, // Lý do AI đưa ra
      reason: [s.rationaleSummary],
      
      confidence: confidencePercent,
      socialScore: 85, // Mock data (DB chưa có trường này)
      
      sentimentType: s.sentimentType,
      sentimentScore: s.sentimentType === 'positive' ? 80 : (s.sentimentType === 'negative' ? -80 : 0),

      // Mock dữ liệu tài chính (DB chưa tính toán PnL dự kiến)
      financialImpact: {
        currentValue: 0,
        projectedValue: 0,
        percentChange: 0,
        riskLevel: 'MEDIUM',
        timeFrame: '24h'
      },

      sources: s.sources ? s.sources.map(src => src.url) : [],
      createdAt: s.detectedAt,
      expiresAt: s.expiresAt
    };
  });

  // 4. Logic Lọc & Đếm
  const filteredProposals = mappedProposals.filter(p => 
    filter === 'ALL' ? true : p.action === filter
  );

  const buyCount = mappedProposals.filter(p => p.action === 'BUY').length;
  const sellCount = mappedProposals.filter(p => p.action === 'SELL').length;

  // Hiển thị lỗi nếu API fail
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="glass-card p-8 rounded-xl text-center max-w-md border border-red-500/30">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4 animate-pulse" />
          <h3 className="text-xl font-bold text-red-400 mb-2">System Error</h3>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* --- HEADER: STATS --- */}
      <div className="glass-card rounded-xl p-8 neon-border relative overflow-hidden group">
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent animate-scan" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-purple-600 to-cyan-600 rounded-xl shadow-lg shadow-purple-500/20 animate-pulse-glow">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                  AI Command Center
                </h1>
                <p className="text-slate-400 mt-1 flex items-center gap-2">
                  <Activity size={14} className="text-green-400" />
                  Real-time market intelligence
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/30 border border-green-500/30 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400">SYSTEM ONLINE</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-black/40 border border-white/5 rounded-xl p-4 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Total Signals</p>
                  <p className="text-3xl font-bold text-white">{signals?.length || 0}</p>
                </div>
                <TrendingUp className="text-purple-500 opacity-50" />
              </div>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-xl p-4 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-green-400 mb-1">Buy Opportunities</p>
                  <p className="text-3xl font-bold text-white">{buyCount}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </div>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-xl p-4 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-red-400 mb-1">Sell Alerts</p>
                  <p className="text-3xl font-bold text-white">{sellCount}</p>
                </div>
                <ShieldAlert className="text-red-500 opacity-50" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- TABS & CONTENT --- */}
      <Tabs defaultValue="ALL" className="w-full" onValueChange={(value) => setFilter(value as any)}>
        <TabsList className="glass-card bg-black/40 p-1 border border-white/10 w-full md:w-auto inline-flex h-auto">
          <TabsTrigger value="ALL" className="px-6 py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary border border-transparent">
            All Signals ({signals?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="BUY" className="px-6 py-2 data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400 border border-transparent">
            Buy ({buyCount})
          </TabsTrigger>
          <TabsTrigger value="SELL" className="px-6 py-2 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400 border border-transparent">
            Sell ({sellCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6 focus:outline-none">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-xl p-6 h-[300px] flex flex-col gap-4">
                   <div className="flex items-center gap-3">
                     <Skeleton className="w-12 h-12 rounded-full bg-white/10" />
                     <div className="space-y-2">
                       <Skeleton className="h-4 w-24 bg-white/10" />
                       <Skeleton className="h-3 w-32 bg-white/10" />
                     </div>
                   </div>
                   <Skeleton className="h-32 w-full bg-white/5 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredProposals.length === 0 ? (
            <div className="glass-card rounded-xl p-16 text-center border-dashed border-2 border-white/10">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Signals Found</h3>
              <p className="text-slate-400">Waiting for AI to detect new market opportunities...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProposals.map((proposal) => (
                <ProposalCardSocial 
                  key={proposal._id} 
                  proposal={proposal as any} // Ép kiểu để tương thích UI cũ
                  onViewDetails={onViewProposal} 
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}