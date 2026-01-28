'use client';

import { useMemo, useState, useEffect } from 'react';
import { Clock, Twitter, ShieldCheck } from 'lucide-react'; // Dùng Twitter icon, sau này có thể import X icon nếu thư viện có
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { useRouter } from 'next/navigation';

const formatCurrency = (num: number) => {
  if (!num) return '$0.00';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const getTimeRemaining = (expiresAtString: string | Date) => {
  if (!expiresAtString) return 'N/A';
  const now = new Date().getTime();
  const expiresAt = new Date(expiresAtString).getTime();
  const diffMs = expiresAt - now;
  if (diffMs <= 0) return 'Expired';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return `${Math.floor(diffMs / (1000 * 60))}m`;
  return `${diffHours}h`;
};

interface ProposalCardSocialProps {
  proposal: any;
  onViewDetails?: (proposalId: string) => void;
}

export function ProposalCardSocial({ proposal, onViewDetails }: ProposalCardSocialProps) {
  const router = useRouter();
  const [realData, setRealData] = useState<any>(null);

  // Gọi API để lấy Risk, ROI từ Proposal DB
  useEffect(() => {
    async function fetchDetails() {
      // Dùng signalId để gọi API (vì dashboard list từ signals)
      const queryId = proposal.signalId || proposal._id;
      if (!queryId) return;

      try {
        // Gọi route đã sửa ở Bước 2 (hỗ trợ tìm bằng signalID)
        const res = await fetch(`/api/proposals/${queryId}`);
        if (res.ok) {
          const data = await res.json();
          setRealData(data);
        }
      } catch (error) {
        console.error("Failed to fetch proposal details", error);
      }
    }
    fetchDetails();
  }, [proposal.signalId, proposal._id]);

  const displayData = realData || proposal;
  const action = displayData.action?.toUpperCase() || 'HOLD';
  const riskLevel = displayData.financialImpact?.riskLevel || 'MEDIUM'; // Lấy từ DB
  const percentChange = displayData.financialImpact?.percentChange || 0;

  // Config màu sắc
  const config = useMemo(() => {
    if (action === 'BUY') return { color: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/10', gradient: 'from-green-500' };
    if (action === 'SELL') return { color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/10', gradient: 'from-red-500' };
    return { color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10', gradient: 'from-purple-500' };
  }, [action]);

  const handleClick = () => {
    const id = displayData._id || proposal._id; // Ưu tiên ID thật của Proposal
    if (onViewDetails) onViewDetails(id);
    else router.push(`/proposal/${id}`);
  };

  return (
    <div className="glass-card glass-card-hover rounded-xl p-6 relative overflow-hidden group border border-white/5 transition-all">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.gradient} to-transparent`} />
      
      <div className="flex justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center font-bold ${config.color} border ${config.border}`}>
            {proposal.tokenSymbol?.slice(0, 2)}
          </div>
          <div>
            <h3 className="font-bold text-white">{proposal.tokenSymbol}</h3>
            <p className="text-[10px] text-slate-500 font-mono">{proposal.tokenName}</p>
          </div>
        </div>
        
        {/* Social Spike -> X / Twitter */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 text-[10px] text-white font-bold px-2 py-0.5 bg-black/50 rounded border border-white/10">
            <span className="font-mono">𝕏</span> 
            <span>TWITTER</span>
          </div>
          <div className={`${config.bg} ${config.color} text-[10px] font-bold px-2 py-0.5 rounded border ${config.border}`}>
            {proposal.confidence}% CONFIDENCE
          </div>
        </div>
      </div>

      <h4 className="text-sm font-medium mb-4 line-clamp-2 min-h-[40px] text-slate-200">
        {displayData.title || proposal.summary}
      </h4>

      <div className={`${config.bg} ${config.border} border rounded-lg p-3 mb-4`}>
        <div className="flex justify-between text-[10px] font-bold mb-1">
          <span className="text-slate-500 uppercase">Target ROI</span>
          <span className={config.color}>{action}</span>
        </div>
        <p className={`text-2xl font-black ${config.color}`}>
          {percentChange > 0 ? '+' : ''}{percentChange.toFixed(2)}%
        </p>
         <div className="text-[10px] text-slate-500 mt-1 font-mono">
             {formatCurrency(displayData.financialImpact?.currentValue)} → <span className={config.color}>{formatCurrency(displayData.financialImpact?.projectedValue)}</span>
         </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
        <div className="flex items-center gap-1">
          <ShieldCheck size={12} className={config.color} />
          RISK: <span className="text-white uppercase">{riskLevel}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={12} />
          {getTimeRemaining(proposal.expiresAt)}
        </div>
      </div>

      <Button onClick={handleClick} className={`w-full mt-4 bg-transparent border ${config.border} ${config.color} hover:${config.bg} transition-all font-bold text-xs py-5`}>
        VIEW ANALYSIS
      </Button>
    </div>
  );
}