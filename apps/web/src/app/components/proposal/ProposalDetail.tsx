import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProposal } from '../../hooks/useProposals';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  ArrowLeft, 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  Clock, 
  Target,
  DollarSign,
  Activity,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Brain
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChainOfThought } from './ChainOfThought';
import { RelevantTweets } from './RelevantTweets';
import { RiskSimulation } from './RiskSimulation';

// Mock price history data
const generatePriceHistory = (currentPrice: number) => {
  const data = [];
  const days = 30;
  let price = currentPrice * 0.85;
  
  for (let i = 0; i < days; i++) {
    const change = (Math.random() - 0.45) * (currentPrice * 0.02);
    price += change;
    data.push({
      date: new Date(Date.now() - (days - i) * 86400000).toLocaleDateString(),
      price: Number(price.toFixed(4)),
    });
  }
  
  return data;
};

export function ProposalDetail() {
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
  const isPositive = proposal.potentialReturn > 0;
  const priceHistory = generatePriceHistory(proposal.currentPrice);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) {
      return `$${(num / 1_000_000_000).toFixed(2)}B`;
    }
    if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(2)}M`;
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
      <div className="glass-card rounded-xl p-8 neon-border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full bg-gradient-purple-cyan flex items-center justify-center neon-glow">
              <span className="text-white font-bold text-2xl">{proposal.tokenSymbol.slice(0, 2)}</span>
            </div>
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold">{proposal.tokenSymbol}</h1>
                <Badge className={`${isBuy ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'} border`}>
                  {isBuy ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                  {proposal.action}
                </Badge>
                <Badge className={`${getRiskColor(proposal.riskLevel)} border`}>
                  {proposal.riskLevel} RISK
                </Badge>
              </div>
              <p className="text-muted-foreground">{proposal.tokenName}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Confidence Score</p>
              <div className="flex items-center space-x-2">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-purple-cyan" 
                    style={{ width: `${proposal.confidence}%` }}
                  ></div>
                </div>
                <span className="text-xl font-bold text-primary">{proposal.confidence}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chain of Thought Timeline */}
          <ChainOfThought steps={proposal.chainOfThought} />

          {/* Relevant Tweets */}
          <RelevantTweets tweets={proposal.relevantTweets} />

          {/* Price Chart */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-primary" />
              Price History (30 Days)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={priceHistory}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(168, 85, 247, 0.1)" />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(15, 6, 30, 0.95)',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                    borderRadius: '8px',
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#a855f7" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorPrice)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* AI Analysis */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-secondary" />
              AI Analysis
            </h2>
            <div className="bg-accent/50 rounded-lg p-4 border border-primary/20">
              <p className="text-foreground leading-relaxed">{proposal.aiReasoning}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Time Horizon</p>
                </div>
                <p className="font-semibold">{proposal.timeHorizon}</p>
              </div>

              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Ecosystem</p>
                </div>
                <p className="font-semibold">{proposal.ecosystem}</p>
              </div>
            </div>
          </div>

          {/* Market Data */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Market Data</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Market Cap</p>
                <p className="text-lg font-semibold">{formatNumber(proposal.marketCap)}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">24h Volume</p>
                <p className="text-lg font-semibold">{formatNumber(proposal.volume24h)}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">24h Change</p>
                <p className={`text-lg font-semibold ${proposal.priceChange24h > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {proposal.priceChange24h > 0 ? '+' : ''}{proposal.priceChange24h.toFixed(2)}%
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Token Address</p>
                <p className="text-xs font-mono break-all">{proposal.tokenAddress.slice(0, 8)}...{proposal.tokenAddress.slice(-8)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Execute Trade */}
        <div className="lg:col-span-1 space-y-6">
          {/* Risk Simulation */}
          <RiskSimulation
            targetPrice={proposal.targetPrice}
            currentPrice={proposal.currentPrice}
            potentialReturn={proposal.potentialReturn}
            suggestedAmount={proposal.suggestedAmount}
            onAmountChange={(newAmount) => setAmount(newAmount)}
          />

          {/* Execute Trade Card */}
          <div className="glass-card rounded-xl p-6 neon-border sticky top-24">
            <h2 className="text-xl font-semibold mb-6">Execute Trade</h2>

            {/* Price Info */}
            <div className="space-y-4 mb-6">
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Current Price</p>
                <p className="text-2xl font-bold">{formatNumber(proposal.currentPrice)}</p>
              </div>

              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-sm text-primary mb-1">Target Price</p>
                <p className="text-2xl font-bold text-primary">{formatNumber(proposal.targetPrice)}</p>
              </div>

              <div className={`${isPositive ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border rounded-lg p-4`}>
                <div className="flex items-center space-x-2 mb-1">
                  <TrendingUp className={`h-4 w-4 ${isPositive ? 'text-green-400' : 'text-red-400'}`} />
                  <p className={`text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    Potential Return
                  </p>
                </div>
                <p className={`text-2xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{proposal.potentialReturn.toFixed(2)}%
                </p>
              </div>
            </div>

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
              className={`w-full ${isBuy ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} transition-colors`}
            >
              {executing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {isBuy ? <ArrowUpRight className="h-4 w-4 mr-2" /> : <ArrowDownRight className="h-4 w-4 mr-2" />}
                  Execute {proposal.action}
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              By executing this trade, you agree to the platform's terms and understand the associated risks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}