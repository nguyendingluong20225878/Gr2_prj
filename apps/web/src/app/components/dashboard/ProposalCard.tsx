import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, TrendingUp, Clock, Target, Twitter, Volume2, Waves, Sparkles, Info } from 'lucide-react';
import { Proposal } from '../../hooks/useProposals';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useState } from 'react';

interface ProposalCardProps {
  proposal: Proposal;
}

export function ProposalCard({ proposal }: ProposalCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const isPositive = proposal.potentialReturn > 0;
  const isBuy = proposal.action === 'BUY';

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'MEDIUM':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'HIGH':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) {
      return `$${(num / 1_000_000_000).toFixed(2)}B`;
    }
    if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(2)}M`;
    }
    return `$${num.toFixed(2)}`;
  };

  // Signal Source Icon & Color
  const getSignalSourceConfig = () => {
    switch (proposal.signalSource) {
      case 'x-scraper':
        return { 
          icon: Twitter, 
          label: 'X Signal', 
          color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30' 
        };
      case 'volume-alert':
        return { 
          icon: Volume2, 
          label: 'Volume Alert', 
          color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' 
        };
      case 'whale-movement':
        return { 
          icon: Waves, 
          label: 'Whale Activity', 
          color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' 
        };
      case 'social-spike':
        return { 
          icon: Sparkles, 
          label: 'Social Spike', 
          color: 'text-pink-400 bg-pink-400/10 border-pink-400/30' 
        };
      default:
        return { 
          icon: TrendingUp, 
          label: 'Signal', 
          color: 'text-slate-400 bg-slate-400/10 border-slate-400/30' 
        };
    }
  };

  // Sentiment Color
  const getSentimentConfig = () => {
    const score = proposal.sentimentScore;
    if (score >= 75) {
      return {
        gradient: 'from-green-400 via-green-500 to-cyan-400',
        label: 'Extreme Bullish',
        bgClass: 'bg-green-500/20 border-green-400/30'
      };
    } else if (score >= 25) {
      return {
        gradient: 'from-cyan-400 via-blue-500 to-purple-400',
        label: 'Bullish',
        bgClass: 'bg-cyan-500/20 border-cyan-400/30'
      };
    } else if (score >= -25) {
      return {
        gradient: 'from-purple-400 via-slate-500 to-purple-400',
        label: 'Neutral',
        bgClass: 'bg-purple-500/20 border-purple-400/30'
      };
    } else if (score >= -75) {
      return {
        gradient: 'from-orange-400 via-red-500 to-red-400',
        label: 'Bearish',
        bgClass: 'bg-orange-500/20 border-orange-400/30'
      };
    } else {
      return {
        gradient: 'from-red-400 via-red-600 to-red-800',
        label: 'Extreme Bearish',
        bgClass: 'bg-red-500/20 border-red-400/30'
      };
    }
  };

  const signalConfig = getSignalSourceConfig();
  const SignalIcon = signalConfig.icon;
  const sentimentConfig = getSentimentConfig();

  return (
    <div className="glass-card glass-card-hover rounded-xl p-6 relative overflow-hidden">
      {/* Gradient overlay */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${sentimentConfig.gradient}`}></div>

      {/* Signal Source Badge */}
      <div className="absolute top-4 right-4">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium ${signalConfig.color}`}>
          <SignalIcon className="w-3 h-3" />
          <span className="hidden sm:inline">{signalConfig.label}</span>
        </div>
      </div>

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-gradient-purple-cyan flex items-center justify-center neon-glow">
            <span className="text-white font-bold text-lg">{proposal.tokenSymbol.slice(0, 2)}</span>
          </div>
          <div>
            <h3 className="font-semibold text-lg">{proposal.tokenSymbol}</h3>
            <p className="text-sm text-muted-foreground">{proposal.tokenName}</p>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-2 mt-8">
          <Badge className={`${isBuy ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'} border`}>
            {isBuy ? (
              <ArrowUpRight className="h-3 w-3 mr-1" />
            ) : (
              <ArrowDownRight className="h-3 w-3 mr-1" />
            )}
            {proposal.action}
          </Badge>
          <Badge className={`${getRiskColor(proposal.riskLevel)} border`}>
            {proposal.riskLevel}
          </Badge>
        </div>
      </div>

      {/* Sentiment Heatmap Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-muted-foreground">Market Sentiment</p>
          <p className="text-xs font-medium text-slate-300">{sentimentConfig.label}</p>
        </div>
        <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r ${sentimentConfig.gradient} transition-all duration-500`}
            style={{ width: `${Math.abs(proposal.sentimentScore)}%` }}
          />
        </div>
      </div>

      {/* Price Info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Current Price</p>
          <p className="font-semibold">{formatNumber(proposal.currentPrice)}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Target Price</p>
          <p className="font-semibold text-primary">{formatNumber(proposal.targetPrice)}</p>
        </div>
      </div>

      {/* Confidence & Return */}
      <div className="relative mb-4">
        <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">AI Confidence</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{proposal.confidence}%</p>
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Info className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Target className="h-4 w-4 text-secondary" />
            <div>
              <p className="text-xs text-muted-foreground">Potential Return</p>
              <p className={`font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{proposal.potentialReturn.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* Confidence Breakdown Tooltip */}
        {showBreakdown && (
          <div className="absolute left-0 right-0 top-full mt-2 glass-card p-4 rounded-lg border border-cyan-400/30 z-10 space-y-2">
            <p className="text-xs font-semibold text-cyan-400 mb-2">Confidence Breakdown</p>
            
            <div className="space-y-2">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400">Technical Analysis</span>
                  <span className="text-xs font-medium text-slate-200">{proposal.confidenceBreakdown.technical}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-400"
                    style={{ width: `${proposal.confidenceBreakdown.technical}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400">Social Sentiment</span>
                  <span className="text-xs font-medium text-slate-200">{proposal.confidenceBreakdown.socialSentiment}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                    style={{ width: `${proposal.confidenceBreakdown.socialSentiment}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400">On-Chain Data</span>
                  <span className="text-xs font-medium text-slate-200">{proposal.confidenceBreakdown.onChainData}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-green-400"
                    style={{ width: `${proposal.confidenceBreakdown.onChainData}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Reasoning */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {proposal.aiReasoning}
        </p>
      </div>

      {/* Time Horizon */}
      <div className="flex items-center space-x-2 mb-4 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>{proposal.timeHorizon}</span>
      </div>

      {/* Action Button */}
      <Link to={`/proposal/${proposal._id}`}>
        <Button className="w-full bg-gradient-purple-cyan hover:opacity-90 transition-opacity">
          View Details
        </Button>
      </Link>
    </div>
  );
}