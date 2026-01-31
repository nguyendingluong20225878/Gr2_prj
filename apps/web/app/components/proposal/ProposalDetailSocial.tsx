'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  ArrowLeft, Loader2, Share2, Zap, Wallet 
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { toast } from 'sonner';

// Components
import { TheNumbers } from './TheNumbers';
import { TheLogic } from './TheLogic';
import { TheEvidence } from './TheEvidence';
import { RiskSimulation } from './RiskSimulation';

interface ProposalDetailSocialProps {
  onBack?: () => void;
}

export function ProposalDetailSocial({ onBack }: ProposalDetailSocialProps) {
  const router = useRouter();
  const params = useParams(); 
  const { connected } = useWallet();
  
  const [proposal, setProposal] = useState<any>(null);
  const [signal, setSignal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch Data
  useEffect(() => {
    async function fetchData() {
      if (!params?.id) return;
      setLoading(true);
      try {
        const propRes = await fetch(`/api/proposals/${params.id}`);
        if (!propRes.ok) throw new Error('Proposal not found (404)');
        const propData = await propRes.json();
        setProposal(propData);

        const signalId = propData.triggerSignalId || propData.triggerEventId || propData.signalId;
        if (signalId) {
          const sigRes = await fetch(`/api/signals/${signalId}`);
          if (sigRes.ok) {
            const sigData = await sigRes.json();
            setSignal(sigData);
          }
        }
      } catch (error: any) {
        console.error("Error fetching details:", error);
        toast.error(error.message || "Cannot load data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.id]);

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-cyan-400" /></div>;
  if (!proposal) return <div className="p-10 text-center text-red-400">Proposal not found.</div>;

  // --- LOGIC HIỂN THỊ ---
  const action = proposal.action?.toUpperCase() || 'HOLD';
  let actionConfig = {
    style: 'bg-purple-500/10 border-purple-500/40 text-purple-400 shadow-purple-500/10',
    iconColor: 'text-purple-400',
    gradient: 'bg-gradient-to-r from-purple-500 via-violet-500 to-purple-500'
  };
  if (action === 'BUY') {
    actionConfig = {
      style: 'bg-green-500/10 border-green-500/40 text-green-400 shadow-green-500/10',
      iconColor: 'text-green-400',
      gradient: 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-500'
    };
  } else if (action === 'SELL') {
    actionConfig = {
      style: 'bg-red-500/10 border-red-500/40 text-red-400 shadow-red-500/10',
      iconColor: 'text-red-400',
      gradient: 'bg-gradient-to-r from-red-500 via-orange-500 to-red-500'
    };
  }

  const rawConfidence = proposal.confidence || 0;
  const displayConfidence = rawConfidence <= 1 ? Math.round(rawConfidence * 100) : rawConfidence;
  
  const safeTokenSymbol = proposal.tokenSymbol || (proposal.title ? proposal.title.split(' ')[0] : 'TOKEN');
  
  // FIX GIÁ: Nếu giá quá lớn, reset về giá mặc định
  let realUnitPrice = proposal.financialImpact?.currentValue || 0;
  if (safeTokenSymbol === 'SOL' && realUnitPrice > 1000) {
      realUnitPrice = 168.48; 
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto pb-24 px-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" onClick={handleBack} className="text-slate-400 hover:text-white gap-2 pl-0">
          <ArrowLeft className="w-5 h-5" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <p className="text-xs text-cyan-400 font-mono border border-cyan-500/30 px-2 py-1 rounded">
            {proposal.status?.toUpperCase() || 'ACTIVE'}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="flex items-center gap-3">
           <div className="w-14 h-14 rounded-full bg-gradient-purple-cyan flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.3)]">
              <span className="text-white font-black text-xl">{safeTokenSymbol.slice(0, 2)}</span>
           </div>
           <div>
              <h1 className="text-3xl font-bold text-white">{proposal.title}</h1>
              {/* [ĐÃ ẨN] ID ở Header theo yêu cầu */}
           </div>
        </div>
        <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border-2 shadow-lg ${actionConfig.style}`}>
          <Zap className={`w-6 h-6 ${actionConfig.iconColor} fill-current`} />
          <span className="text-2xl font-black tracking-widest italic uppercase">{action}</span>
        </div>
      </div>

      {/* TABS */}
      <Tabs defaultValue="numbers" className="w-full">
        <TabsList className="grid grid-cols-4 w-full bg-slate-900/80 border border-white/5 p-1.5 mb-10 rounded-2xl h-auto shadow-2xl backdrop-blur-md">
          <TabsTrigger value="numbers" className="py-3.5 rounded-xl font-bold text-xs md:text-sm data-[state=active]:bg-gradient-purple-cyan data-[state=active]:text-white">FINANCIALS</TabsTrigger>
          <TabsTrigger value="logic" className="py-3.5 rounded-xl font-bold text-xs md:text-sm data-[state=active]:bg-gradient-purple-cyan data-[state=active]:text-white">ANALYSIS</TabsTrigger>
          <TabsTrigger value="evidence" className="py-3.5 rounded-xl font-bold text-xs md:text-sm data-[state=active]:bg-gradient-purple-cyan data-[state=active]:text-white">SOURCE</TabsTrigger>
          <TabsTrigger value="execute" className={`py-3.5 rounded-xl font-black text-xs md:text-sm data-[state=active]:text-white data-[state=active]:${actionConfig.gradient}`}>TRADE</TabsTrigger>
        </TabsList>

        <TabsContent value="numbers">
          <TheNumbers 
            currentValue={realUnitPrice} 
            projectedValue={proposal.financialImpact?.projectedValue || 0}
            percentChange={proposal.financialImpact?.percentChange || 0}
            tokenSymbol={safeTokenSymbol}
          />
        </TabsContent>

        <TabsContent value="logic">
          <TheLogic reason={proposal.reason || []} rationaleSummary={proposal.summary || ''} confidence={displayConfidence} />
        </TabsContent>

        <TabsContent value="evidence">
          <TheEvidence signalData={signal} tokenSymbol={safeTokenSymbol} overrideSources={proposal.sources || signal?.sources} />
        </TabsContent>

        {/* TAB EXECUTE */}
        <TabsContent value="execute">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <RiskSimulation 
               currentPrice={realUnitPrice}
               targetPrice={proposal.financialImpact?.projectedValue || 0}
               stopLoss={0}
               recommendation={proposal.action}
               roi={proposal.financialImpact?.roi || 0}
               tokenSymbol={safeTokenSymbol}
               proposalId={proposal._id}
              />
            </div>
            
            {/* Sidebar Status */}
            <div className="space-y-6">
              <div className="glass-card p-6 border border-white/5 rounded-2xl bg-slate-900/40">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
                  Wallet Status
                </h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300 flex items-center gap-2">
                    <Wallet size={14} /> Connected
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {connected ? 'YES' : 'NO'}
                  </span>
                </div>
              </div>

              {/* [ĐÃ BẬT LẠI] Box Strategy ID ở Sidebar (Tab Trade) */}
              <div className="p-1 rounded-2xl bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500 opacity-80">
                <div className="bg-slate-950 rounded-[14px] p-5">
                   <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Strategy ID</p>
                   <p className="text-xs font-mono text-slate-300 truncate">{proposal._id}</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}