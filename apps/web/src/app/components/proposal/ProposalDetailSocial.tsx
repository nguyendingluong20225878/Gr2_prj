import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProposal } from '../../hooks/useProposals';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  ArrowLeft, 
  ArrowUpRight, 
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  DollarSign,
  Brain,
  Twitter
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { TheNumbers } from './TheNumbers';
import { TheLogic } from './TheLogic';
import { TheEvidence } from './TheEvidence';
import { RiskSimulation } from './RiskSimulation';

export function ProposalDetailSocial() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { proposal, loading, error } = useProposal(id || '');
  const { connected, publicKey } = useWallet();
  const [amount, setAmount] = useState(0);
  const [executing, setExecuting] = useState(false);

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
      // ==========================================
      // TODO: Implement Solana transaction logic
      // 1. Create transaction với @solana/web3.js
      // 2. Sign transaction với wallet
      // 3. Send transaction
      // 4. Lưu trade vào MongoDB
      // ==========================================
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockTxSignature = Math.random().toString(36).substring(7);
      
      toast.success('Trade executed successfully!', {
        description: `Transaction: ${mockTxSignature}`,
      });

      setTimeout(() => {
        navigate('/portfolio');
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
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isBuy = proposal.action === 'BUY';
  const roi = proposal.financialImpact.projectedValue - proposal.financialImpact.currentValue;
  const isPositive = roi > 0;

  const formatCurrency = (num: number) => {
    if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `$${(num / 1_000).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'MEDIUM':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'HIGH':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/dashboard')}
        className="hover:bg-accent"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      {/* Header */}
      <div className="glass-card rounded-xl p-8 neon-border relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyber-cyan/5 to-transparent animate-scan" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            {/* Left: Token Info */}
            <div className="flex items-start space-x-4">
              <div className="w-20 h-20 rounded-full bg-gradient-purple-cyan flex items-center justify-center neon-glow">
                <span className="text-white font-bold text-3xl">{proposal.tokenSymbol.slice(0, 2)}</span>
              </div>
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-4xl font-bold gradient-text">{proposal.tokenSymbol}</h1>
                  <Badge className={`${isBuy ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'} border`}>
                    {isBuy ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />}
                    {proposal.action}
                  </Badge>
                </div>
                <p className="text-lg text-muted-foreground mb-3">{proposal.tokenName}</p>
                
                {/* Title */}
                <h2 className="text-xl font-semibold text-slate-200 mb-2">{proposal.title}</h2>

                {/* Badges Row */}
                <div className="flex flex-wrap gap-2">
                  {/* Social Source */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-cyan-400/10 border-cyan-400/30 text-cyan-400 text-sm font-medium">
                    <Twitter className="w-4 h-4" />
                    <span>Social Signal</span>
                  </div>

                  {/* Confidence */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-green-500/10 border-green-500/30">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-sm font-semibold">{proposal.confidence}% Confidence</span>
                  </div>

                  {/* Risk */}
                  <Badge className={`${getRiskColor(proposal.financialImpact.riskLevel)} border`}>
                    {proposal.financialImpact.riskLevel} RISK
                  </Badge>

                  {/* Sentiment */}
                  <Badge className={proposal.sentimentType === 'positive' ? 'bg-green-500/20 text-green-400 border-green-500/50 border' : 'bg-red-500/20 text-red-400 border-red-500/50 border'}>
                    {proposal.sentimentType === 'positive' ? '📈 BULLISH' : '📉 BEARISH'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Right: Big Money Display */}
            <div className={`${isPositive ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border-2 rounded-xl p-6 relative overflow-hidden min-w-[280px]`}>
              <div className={`absolute top-0 right-0 w-24 h-24 ${isPositive ? 'bg-green-500/20' : 'bg-red-500/20'} blur-2xl`} />
              
              <div className="relative text-center">
                <p className="text-xs text-muted-foreground mb-2">Expected Profit</p>
                <p className={`text-4xl font-bold font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{formatCurrency(roi)}
                </p>
                <p className={`text-sm mt-1 ${isPositive ? 'text-green-400/70' : 'text-red-400/70'}`}>
                  ({isPositive ? '+' : ''}{((roi / proposal.financialImpact.currentValue) * 100).toFixed(2)}% ROI)
                </p>

                <div className="flex items-center justify-center gap-2 mt-3 text-xs text-slate-400">
                  <span>{formatCurrency(proposal.financialImpact.currentValue)}</span>
                  <span>→</span>
                  <span className="text-cyan-400">{formatCurrency(proposal.financialImpact.projectedValue)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Tabbed Sections */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="numbers" className="w-full">
            <TabsList className="glass-card w-full grid grid-cols-3 mb-6">
              <TabsTrigger value="numbers" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span className="hidden sm:inline">Numbers</span>
              </TabsTrigger>
              <TabsTrigger value="logic" className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">Logic</span>
              </TabsTrigger>
              <TabsTrigger value="evidence" className="flex items-center gap-2">
                <Twitter className="w-4 h-4" />
                <span className="hidden sm:inline">Evidence</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="numbers">
              <TheNumbers 
                currentValue={proposal.financialImpact.currentValue}
                projectedValue={proposal.financialImpact.projectedValue}
                tokenSymbol={proposal.tokenSymbol}
              />
            </TabsContent>

            <TabsContent value="logic">
              <TheLogic 
                reason={proposal.reason}
                rationaleSummary={proposal.rationaleSummary}
                confidence={proposal.confidence}
              />
            </TabsContent>

            <TabsContent value="evidence">
              <TheEvidence 
                sources={proposal.sources}
                tokenSymbol={proposal.tokenSymbol}
                triggerEventId={proposal.triggerEventId}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Risk Simulation */}
          <RiskSimulation
            targetPrice={proposal.financialImpact.projectedValue}
            currentPrice={proposal.financialImpact.currentValue}
            potentialReturn={((roi / proposal.financialImpact.currentValue) * 100)}
            suggestedAmount={proposal.suggestedAmount}
            onAmountChange={(newAmount) => setAmount(newAmount)}
          />

          {/* Execute Trade Card */}
          <div className="glass-card rounded-xl p-6 neon-border sticky top-24">
            <h2 className="text-xl font-semibold mb-6">Execute Trade</h2>

            {/* Wallet Status */}
            {!connected ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-400">Wallet Not Connected</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please connect your Phantom wallet to execute trades
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-400">Wallet Connected</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">
                      {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Execute Button */}
            <Button
              onClick={handleExecuteTrade}
              disabled={!connected || !amount || amount <= 0 || executing}
              className={`w-full ${isBuy ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} transition-colors text-lg py-6`}
            >
              {executing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {isBuy ? <ArrowUpRight className="h-5 w-5 mr-2" /> : <ArrowDownRight className="h-5 w-5 mr-2" />}
                  Execute {proposal.action} Trade
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed">
              By executing this trade, you agree to the platform's terms and understand the associated risks. This is not financial advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
