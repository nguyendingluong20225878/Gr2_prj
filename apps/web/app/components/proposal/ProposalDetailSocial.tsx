'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  ArrowLeft, ArrowUpRight, ArrowDownRight,
  Loader2, MinusCircle 
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

// ✅ THÊM LẠI INTERFACE NÀY
interface ProposalDetailSocialProps {
  onBack?: () => void; // Cho phép component cha tùy chỉnh hành động Back
}

export function ProposalDetailSocial({ onBack }: ProposalDetailSocialProps) {
  const router = useRouter();
  const params = useParams(); 
  const { connected } = useWallet();
  
  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(0);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (params?.id) {
      setLoading(true);
      fetch(`/api/proposals/${params.id}`)
        .then(res => {
            if (!res.ok) throw new Error("API Error");
            return res.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            setProposal(data);
        })
        .catch(err => {
            console.error("Fetch error:", err);
            toast.error("Failed to load proposal details");
        })
        .finally(() => setLoading(false));
    }
  }, [params?.id]);

  // ✅ Logic Back: Ưu tiên onBack từ Props, nếu không có thì mặc định về Dashboard
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push('/dashboard');
    }
  };

  const handleExecuteTrade = async () => {
    if (!connected) return toast.error('Please connect wallet');
    setExecuting(true);
    // Fake logic trade
    setTimeout(() => {
        setExecuting(false);
        toast.success('Trade Executed (Simulation)');
    }, 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6 container mx-auto p-4">
        <Skeleton className="h-12 w-32" />
        <div className="glass-card rounded-xl p-8 h-[500px] flex items-center justify-center">
            <Loader2 className="animate-spin w-10 h-10 text-purple-500"/>
        </div>
      </div>
    );
  }

  if (!proposal) return <div className="text-center p-20">Proposal not found.</div>;

  const isBuy = proposal.action === 'BUY';
  const isHold = proposal.action === 'HOLD';
  
  const actionColor = isBuy 
    ? 'text-green-400 border-green-500 bg-green-500/10' 
    : isHold 
      ? 'text-slate-300 border-slate-500 bg-slate-500/10' 
      : 'text-red-400 border-red-500 bg-red-500/10';

  return (
    <div className="space-y-6 container mx-auto p-4 animate-in fade-in">
      {/* Back Button */}
      <Button variant="ghost" onClick={handleBack} className="gap-2 hover:bg-white/5">
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>

      {/* Header Card */}
      <div className="glass-card rounded-xl p-8 neon-border">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold gradient-text">{proposal.tokenSymbol}</h1>
              <Badge className={`text-lg px-4 py-1 border-2 ${actionColor}`}>
                {isBuy ? <><ArrowUpRight className="w-5 mr-1" /> BUY</> : 
                 isHold ? <><MinusCircle className="w-5 mr-1" /> HOLD</> : 
                 <><ArrowDownRight className="w-5 mr-1" /> SELL</>}
              </Badge>
            </div>
            <p className="text-slate-400 text-lg max-w-2xl">{proposal.title}</p>
          </div>
          
          <div className="flex gap-4">
             <div className="text-center bg-black/40 p-4 rounded-xl min-w-[120px] border border-white/5">
                <div className="text-xs text-slate-400 mb-1">Confidence</div>
                <div className="text-3xl font-bold text-green-400">{proposal.confidence}%</div>
             </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="numbers" className="space-y-6">
        <TabsList className="glass-card p-1 w-full grid grid-cols-4">
          <TabsTrigger value="numbers">Numbers</TabsTrigger>
          <TabsTrigger value="logic">Logic</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="execute">Execute</TabsTrigger>
        </TabsList>

        <TabsContent value="numbers">
          <TheNumbers 
            currentValue={proposal.financialImpact.currentValue} 
            projectedValue={proposal.financialImpact.projectedValue} 
            percentChange={proposal.financialImpact.percentChange} 
            tokenSymbol={proposal.tokenSymbol} 
          />
        </TabsContent>

        <TabsContent value="logic">
          <TheLogic 
            reason={proposal.reason} 
            rationaleSummary={proposal.summary} 
            confidence={proposal.confidence} 
          />
        </TabsContent>

        <TabsContent value="evidence">
          <TheEvidence 
            sources={proposal.sources} 
            tokenSymbol={proposal.tokenSymbol} 
            triggerEventId={proposal._id} 
          />
        </TabsContent>

        <TabsContent value="execute">
          <div className="space-y-4">
            <RiskSimulation 
              targetPrice={proposal.financialImpact.projectedValue}
              currentPrice={proposal.financialImpact.currentValue}
              potentialReturn={proposal.financialImpact.percentChange}
              suggestedAmount={100}
              onAmountChange={setAmount}
            />
            <div className="glass-card p-6 border border-white/10">
                <Button 
                  onClick={handleExecuteTrade} 
                  disabled={executing || isHold} 
                  className="w-full py-6 text-lg bg-gradient-purple-cyan font-bold shadow-lg shadow-cyan-500/20"
                >
                  {executing ? <Loader2 className="animate-spin" /> : 
                   isHold ? 'Action Paused (HOLD)' : 'Execute Trade Now'}
                </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}