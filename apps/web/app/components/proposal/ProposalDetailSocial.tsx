'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  ArrowLeft, 
  ArrowUpRight, 
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Brain,
  Twitter
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { TheNumbers } from './TheNumbers';
import { TheLogic } from './TheLogic';
import { TheEvidence } from './TheEvidence';
import { RiskSimulation } from './RiskSimulation';

interface ProposalDetailSocialProps {
  proposal?: any;
  loading?: boolean;
  error?: string;
  onBack?: () => void;
  onNavigateToPortfolio?: () => void;
}

export function ProposalDetailSocial({ 
  proposal: propProposal,
  loading: propLoading = false,
  error: propError,
  onBack,
  onNavigateToPortfolio
}: ProposalDetailSocialProps) {
  const { connected, publicKey } = useWallet();
  const [amount, setAmount] = useState(0);
  const [executing, setExecuting] = useState(false);

  // Use passed proposal or create mock data
  const proposal = propProposal || {
    _id: 'mock-1',
    tokenSymbol: 'SOL',
    signal: 'BUY',
    confidence: 92,
    expectedReturn: 18.5,
    timeHorizon: '7d',
    socialScore: 8.7,
    reason: [
      'Twitter volume increased 245% in last 24h with overwhelmingly positive sentiment',
      'Key influencers (>100K followers) showing strong bullish sentiment',
      'Community engagement metrics at all-time high levels',
      'Trending on crypto Twitter with 50K+ mentions'
    ],
    rationaleSummary: 'Strong social momentum across all major platforms. Community sentiment extremely bullish with significant influencer support. Historical patterns indicate high probability of price appreciation.',
    sources: [
      'https://twitter.com/example/status/123456789',
      'https://twitter.com/example/status/987654321',
      'https://twitter.com/example/status/456789123'
    ],
    currentValue: 142.50,
    projectedValue: 168.86,
    targetPrice: 168.86,
    suggestedAmount: 1000,
    triggerEventId: 'EVT_SOL_2026_001'
  };

  const loading = propLoading;
  const error = propError;

  const handleExecuteTrade = async () => {
    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setExecuting(true);
    
    try {
      // Simulate transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockTxSignature = Math.random().toString(36).substring(7);
      
      toast.success('Trade executed successfully!', {
        description: `Transaction: ${mockTxSignature}`,
      });

      setTimeout(() => {
        onNavigateToPortfolio?.();
      }, 1500);
      
    } catch (err) {
      toast.error('Failed to execute trade');
      console.error(err);
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-32" />
        <div className="glass-card rounded-xl p-8">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 rounded-xl text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Proposal Not Found</h3>
          <Button onClick={onBack} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isPositiveSignal = proposal.signal === 'BUY';

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="gap-2 hover:bg-white/5"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Button>

      {/* Header Card */}
      <div className="glass-card rounded-xl p-8 neon-border">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold gradient-text">
                {proposal.tokenSymbol}
              </h1>
              <Badge 
                className={`text-lg px-4 py-1 ${
                  isPositiveSignal 
                    ? 'bg-green-500/20 text-green-400 border-green-500/50' 
                    : 'bg-red-500/20 text-red-400 border-red-500/50'
                } border-2`}
              >
                {isPositiveSignal ? (
                  <><ArrowUpRight className="w-5 h-5 mr-1" /> BUY</>
                ) : (
                  <><ArrowDownRight className="w-5 h-5 mr-1" /> SELL</>
                )}
              </Badge>
            </div>
            <p className="text-slate-400">AI-generated trade signal based on social sentiment analysis</p>
          </div>

          <div className="flex gap-3">
            <div className="glass-card p-4 rounded-lg text-center min-w-[100px]">
              <div className="text-sm text-slate-400 mb-1">Confidence</div>
              <div className="text-2xl font-bold text-green-400">{proposal.confidence}%</div>
            </div>
            <div className="glass-card p-4 rounded-lg text-center min-w-[100px]">
              <div className="text-sm text-slate-400 mb-1">Social Score</div>
              <div className="text-2xl font-bold text-pink-400">{proposal.socialScore}/10</div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-slate-500 mb-1">Current Price</div>
            <div className="text-xl font-bold text-slate-200">${proposal.currentValue.toFixed(2)}</div>
          </div>

          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-slate-500 mb-1">Target Price</div>
            <div className="text-xl font-bold text-cyber-cyan">${proposal.targetPrice.toFixed(2)}</div>
          </div>

          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-slate-500 mb-1">Expected Return</div>
            <div className={`text-xl font-bold ${isPositiveSignal ? 'text-green-400' : 'text-red-400'}`}>
              {isPositiveSignal ? '+' : ''}{proposal.expectedReturn.toFixed(1)}%
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-xs text-slate-500 mb-1">Time Horizon</div>
            <div className="text-xl font-bold text-purple-400">{proposal.timeHorizon}</div>
          </div>
        </div>
      </div>

      {/* Main Content - Tabs */}
      <Tabs defaultValue="numbers" className="space-y-6">
        <TabsList className="glass-card p-1 w-full grid grid-cols-4 gap-1">
          <TabsTrigger value="numbers" className="gap-2">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Numbers</span>
          </TabsTrigger>
          <TabsTrigger value="logic" className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">Logic</span>
          </TabsTrigger>
          <TabsTrigger value="evidence" className="gap-2">
            <Twitter className="w-4 h-4" />
            <span className="hidden sm:inline">Evidence</span>
          </TabsTrigger>
          <TabsTrigger value="execute" className="gap-2">
            <ArrowUpRight className="w-4 h-4" />
            <span className="hidden sm:inline">Execute</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="numbers" className="space-y-6">
          <TheNumbers
            currentValue={proposal.currentValue}
            projectedValue={proposal.projectedValue}
            tokenSymbol={proposal.tokenSymbol}
          />
        </TabsContent>

        <TabsContent value="logic" className="space-y-6">
          <TheLogic
            reason={proposal.reason}
            rationaleSummary={proposal.rationaleSummary}
            confidence={proposal.confidence}
          />
        </TabsContent>

        <TabsContent value="evidence" className="space-y-6">
          <TheEvidence
            sources={proposal.sources}
            tokenSymbol={proposal.tokenSymbol}
            triggerEventId={proposal.triggerEventId}
          />
        </TabsContent>

        <TabsContent value="execute" className="space-y-6">
          <RiskSimulation
            targetPrice={proposal.targetPrice}
            currentPrice={proposal.currentValue}
            potentialReturn={proposal.expectedReturn}
            suggestedAmount={proposal.suggestedAmount}
            onAmountChange={setAmount}
          />

          {/* Execute Trade Button */}
          <div className="glass-card rounded-xl p-6 neon-border">
            <h3 className="text-xl font-semibold mb-4 gradient-text">Execute Trade</h3>
            
            {!connected ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 text-center">
                <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                <p className="text-slate-300 mb-4">Connect your wallet to execute this trade</p>
              </div>
            ) : (
              <Button
                onClick={handleExecuteTrade}
                disabled={executing || !amount || amount <= 0}
                className={`w-full py-6 text-lg font-semibold ${
                  isPositiveSignal
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90'
                    : 'bg-gradient-to-r from-red-500 to-pink-500 hover:opacity-90'
                }`}
              >
                {executing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    {isPositiveSignal ? 'Execute BUY Order' : 'Execute SELL Order'}
                  </>
                )}
              </Button>
            )}

            {/* Disclaimer */}
            <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="text-purple-400 font-semibold">⚠️ Disclaimer:</span> This is an AI-generated signal based on social sentiment analysis. NDL AI is not a financial advisor. Always do your own research (DYOR) and never invest more than you can afford to lose.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
