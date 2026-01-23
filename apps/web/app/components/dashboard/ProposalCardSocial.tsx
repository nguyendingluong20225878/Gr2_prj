'use client';

import { useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, Clock, Twitter, AlertTriangle } from 'lucide-react';
import { ProposalUI } from '@/lib/types';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';

// --- Helper Functions (Nên tách ra file utils.ts) ---
const formatCurrency = (num: number) => {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const getTimeRemaining = (expiresAtString: string | Date) => {
  const now = new Date().getTime();
  const expiresAt = new Date(expiresAtString).getTime();
  const diffMs = expiresAt - now;
  
  if (diffMs <= 0) return 'Đã hết hạn';

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins} phút`;
  } else if (diffHours < 24) {
    return `${diffHours} giờ`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày`;
  }
};

interface ProposalCardSocialProps {
  proposal: ProposalUI;
  onViewDetails?: (proposalId: string) => void;
}

export function ProposalCardSocial({ proposal, onViewDetails }: ProposalCardSocialProps) {
  // Memoize calculations
  const { isBuy, roi, roiPercent, isPositive, currentValue, projectedValue } = useMemo(() => {
    const current = proposal.financialImpact?.currentValue ?? 0;
    const projected = proposal.financialImpact?.projectedValue ?? 0;
    const calcRoi = projected - current;
    
    return {
      isBuy: proposal.action === 'BUY',
      currentValue: current,
      projectedValue: projected,
      roi: calcRoi,
      roiPercent: current !== 0 ? (calcRoi / current) * 100 : 0,
      isPositive: calcRoi > 0
    };
  }, [proposal]);

  // Sentiment Config logic
  const sentimentConfig = useMemo(() => {
    switch (proposal.sentimentType) {
      case 'positive':
        return {
          gradient: 'from-green-400 via-cyan-500 to-green-400',
          label: 'HYPE DETECTED',
          textColor: 'text-green-400',
          bgClass: 'bg-green-500/10 border-green-400/30'
        };
      case 'negative':
        return {
          gradient: 'from-red-400 via-orange-500 to-red-400',
          label: 'FEAR DETECTED',
          textColor: 'text-red-400',
          bgClass: 'bg-red-500/10 border-red-400/30'
        };
      default:
        return {
          gradient: 'from-purple-400 via-slate-500 to-purple-400',
          label: 'NEUTRAL',
          textColor: 'text-purple-400',
          bgClass: 'bg-purple-500/10 border-purple-400/30'
        };
    }
  }, [proposal.sentimentType]);

  // Risk Color Logic
  const riskColorClass = useMemo(() => {
    switch (proposal.financialImpact?.riskLevel) {
      case 'LOW': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'HIGH': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-muted text-muted-foreground';
    }
  }, [proposal.financialImpact?.riskLevel]);

  const handleClick = () => {
    if (onViewDetails) {
      onViewDetails(proposal._id);
    } else if (typeof window !== 'undefined') {
      window.location.href = `/proposal/${proposal._id}`;
    }
  };

  return (
    <div className="glass-card glass-card-hover rounded-xl p-6 relative overflow-hidden group">
      {/* Top Gradient Bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${sentimentConfig.gradient}`}></div>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-gradient-purple-cyan flex items-center justify-center neon-glow shrink-0">
             <span className="text-white font-bold text-lg">
               {proposal?.tokenSymbol?.slice(0, 2) ?? '??'}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-lg">{proposal.tokenSymbol}</h3>
            <p className="text-sm text-muted-foreground">{proposal.tokenName}</p>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-cyan-400/10 border-cyan-400/30 text-cyan-400 text-xs font-medium">
            <Twitter className="w-3 h-3" />
            <span>Social Spike</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-green-500/10 border-green-500/30">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-xs font-semibold">{proposal.confidence}%</span>
          </div>
        </div>
      </div>

      {/* Title & Summary */}
      <h4 className="text-sm font-medium mb-2 line-clamp-2 text-slate-200 min-h-[40px]">
        {proposal.title}
      </h4>
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2 min-h-[32px]">
        {proposal.reason?.[0] || proposal.summary}
      </p>

      {/* Social Vibe Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-muted-foreground">Social Vibe</p>
          <p className={`text-xs font-semibold ${sentimentConfig.textColor}`}>
            {sentimentConfig.label}
          </p>
        </div>
        <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden relative">
          <div 
            className={`h-full bg-gradient-to-r ${sentimentConfig.gradient} transition-all duration-500`}
            style={{ width: `${Math.abs(proposal.sentimentScore || 0)}%` }}
          />
        </div>
      </div>

      {/* Financial Impact */}
      <div className={`${isPositive ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border-2 rounded-lg p-4 mb-4 relative overflow-hidden transition-colors duration-300`}>
        <div className={`absolute top-0 right-0 w-24 h-24 ${isPositive ? 'bg-green-500/20' : 'bg-red-500/20'} blur-2xl pointer-events-none`} />
        
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Dự kiến lãi:</span>
            <Badge className={`${isBuy ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'} border`}>
              {isBuy ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
              {proposal.action}
            </Badge>
          </div>
          
          <div className="flex items-baseline gap-2">
            <p className={`text-3xl font-bold font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{formatCurrency(roi)}
            </p>
            <p className={`text-sm ${isPositive ? 'text-green-400/70' : 'text-red-400/70'}`}>
              ({isPositive ? '+' : ''}{roiPercent.toFixed(2)}%)
            </p>
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <span>{formatCurrency(currentValue)}</span>
            <span>→</span>
            <span className="text-cyan-400">{formatCurrency(projectedValue)}</span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span className="text-xs text-slate-400">Risk Level:</span>
        </div>
        <Badge className={`${riskColorClass} border`}>
          {proposal.financialImpact?.riskLevel || 'UNKNOWN'}
        </Badge>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Hết hạn: {getTimeRemaining(proposal.expiresAt)}</span>
        </div>
      </div>

      <Button 
        onClick={handleClick}
        className="w-full bg-gradient-purple-cyan hover:opacity-90 transition-all font-semibold shadow-lg hover:shadow-cyan-500/20"
      >
        View Proof & Execute
      </Button>
    </div>
  );
}