'use client';

import { useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, Clock, Twitter, AlertTriangle } from 'lucide-react';
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
  if (diffMs <= 0) return 'Đã hết hạn';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return `${Math.floor(diffMs / (1000 * 60))} phút`;
  if (diffHours < 24) return `${diffHours} giờ`;
  return `${Math.floor(diffHours / 24)} ngày`;
};

interface ProposalCardSocialProps {
  proposal: any;
  onViewDetails?: (proposalId: string) => void;
}

export function ProposalCardSocial({ proposal, onViewDetails }: ProposalCardSocialProps) {
  const router = useRouter();

  const stats = useMemo(() => {
    const current = proposal.financialImpact?.currentValue ?? 0;
    const projected = proposal.financialImpact?.projectedValue ?? 0;
    const diff = projected - current;
    const isPositive = (proposal.financialImpact?.percentChange ?? diff) >= 0;
    
    return {
      isBuy: proposal.action === 'BUY',
      roi: diff,
      roiPercent: proposal.financialImpact?.percentChange || (current !== 0 ? (diff / current) * 100 : 0),
      isPositive
    };
  }, [proposal]);

  const sentimentConfig = useMemo(() => {
    const type = proposal.sentimentType?.toLowerCase();
    if (type === 'positive' || stats.isPositive) {
      return { gradient: 'from-green-400 via-cyan-500 to-green-400', label: 'HYPE DETECTED', textColor: 'text-green-400' };
    }
    return { gradient: 'from-red-400 via-orange-500 to-red-400', label: 'FEAR DETECTED', textColor: 'text-red-400' };
  }, [proposal.sentimentType, stats.isPositive]);

  const handleClick = () => {
    // Luôn ưu tiên dùng _id để tránh 404
    const id = proposal._id;
    if (onViewDetails) {
      onViewDetails(id);
    } else {
      router.push(`/proposal/${id}`);
    }
  };

  return (
    <div className="glass-card glass-card-hover rounded-xl p-6 relative overflow-hidden group border border-white/5 transition-all">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${sentimentConfig.gradient}`} />
      
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-gradient-purple-cyan flex items-center justify-center neon-glow shrink-0 font-bold text-white">
            {proposal.tokenSymbol?.slice(0, 2)}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-white">{proposal.tokenSymbol}</h3>
            <p className="text-sm text-slate-400 truncate max-w-[120px]">{proposal.tokenName}</p>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-cyan-400/30 bg-cyan-400/10 text-cyan-400 text-[10px] font-bold uppercase">
            <Twitter className="w-3 h-3" />
            <span>Social Spike</span>
          </div>
          <div className="text-green-400 text-xs font-bold bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded">
            {proposal.confidence}%
          </div>
        </div>
      </div>

      <h4 className="text-sm font-medium mb-2 line-clamp-2 text-slate-200 min-h-[40px] leading-tight">
        {proposal.title}
      </h4>

      <div className={`${stats.isPositive ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'} border-2 rounded-lg p-4 mb-4`}>
        <div className="flex items-center justify-between mb-2 text-[10px] font-bold text-slate-500 uppercase">
          <span>Target ROI</span>
          <Badge className={`${stats.isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} border-none`}>
            {proposal.action}
          </Badge>
        </div>
        
        <div className="flex items-baseline gap-2">
          <p className={`text-3xl font-bold font-mono ${stats.isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {stats.isPositive ? '+' : ''}{stats.roiPercent.toFixed(2)}%
          </p>
        </div>
        <div className="text-[10px] text-slate-500 mt-1 font-mono">
          {formatCurrency(proposal.financialImpact?.currentValue)} → <span className="text-cyan-400">{formatCurrency(proposal.financialImpact?.projectedValue)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-bold">
        <div className="flex items-center gap-1.5 text-slate-400 uppercase tracking-tighter">
          <AlertTriangle className="w-3 h-3 text-yellow-500" />
          Risk: <span className="text-slate-200">{proposal.financialImpact?.riskLevel}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-500">
          <Clock className="w-3 h-3" />
          {getTimeRemaining(proposal.expiresAt)}
        </div>
      </div>

      <Button 
        onClick={handleClick}
        className="w-full mt-4 bg-gradient-purple-cyan hover:opacity-90 transition-all font-bold text-xs py-5"
      >
        VIEW ANALYSIS & EXECUTE
      </Button>
    </div>
  );
}