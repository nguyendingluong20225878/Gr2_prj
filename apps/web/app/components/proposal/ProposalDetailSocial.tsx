'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  ArrowLeft, 
  Loader2, 
  Share2, 
  ExternalLink,
  Zap
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { toast } from 'sonner';

// Import các component con
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
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!params?.id) return;
      
      setLoading(true);
      try {
        // Bước 1: Lấy dữ liệu Proposal (Dữ liệu đã cá nhân hóa cho User)
        const propRes = await fetch(`/api/proposals/${params.id}`);
        
        if (!propRes.ok) {
          if (propRes.status === 404) throw new Error('Không tìm thấy đề xuất (404)');
          throw new Error('Lỗi kết nối đến máy chủ');
        }

        const propData = await propRes.json();
        setProposal(propData);

        // Bước 2: Lấy dữ liệu Signal gốc (Bằng chứng thị trường)
        // Dùng signalId hoặc triggerEventId từ proposal trả về
        const signalId = propData.signalId || propData.triggerEventId;
        
        if (signalId) {
          const sigRes = await fetch(`/api/signals/${signalId}`);
          if (sigRes.ok) {
            const sigData = await sigRes.json();
            setSignal(sigData);
          }
        }
      } catch (error: any) {
        console.error("Error fetching details:", error);
        toast.error(error.message || "Không thể tải dữ liệu.");
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
        <p className="text-slate-400 font-medium animate-pulse">
          Đang phân tích dữ liệu thị trường và danh mục của bạn...
        </p>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-12 text-center glass-card rounded-xl border-red-500/30">
        <p className="text-red-400 font-bold text-lg mb-4">Lỗi: Không tìm thấy dữ liệu đề xuất</p>
        <Button onClick={handleBack} variant="outline" className="border-white/10">
          Quay lại Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto pb-24 px-4">
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-8">
        <Button 
          variant="ghost" 
          onClick={handleBack} 
          className="text-slate-400 hover:text-white hover:bg-white/5 gap-2 pl-0 transition-all"
        >
          <ArrowLeft className="w-5 h-5" /> Quay lại
        </Button>
        
        <div className="flex items-center gap-3">
          <div className="hidden md:block text-right mr-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Status</p>
            <p className="text-xs text-cyan-400 font-mono">{proposal.status?.toUpperCase() || 'ACTIVE'}</p>
          </div>
          <Button variant="outline" size="icon" className="border-white/10 bg-black/20 text-slate-400 hover:text-white">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Identity Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="w-14 h-14 rounded-full bg-gradient-purple-cyan flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                <span className="text-white font-black text-xl">{proposal.tokenSymbol?.slice(0, 2)}</span>
             </div>
             <div>
                <h1 className="text-4xl font-black uppercase tracking-tighter text-white">
                  {proposal.tokenSymbol} <span className="text-slate-500 text-2xl font-light">/ USDC</span>
                </h1>
                <p className="text-slate-400 text-sm font-medium">{proposal.tokenName || 'AI Generated Proposal'}</p>
             </div>
          </div>
        </div>
        
        <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border-2 shadow-lg transition-all duration-500 ${
          proposal.action === 'BUY' 
          ? 'bg-green-500/10 border-green-500/40 text-green-400 shadow-green-500/10' 
          : 'bg-red-500/10 border-red-500/40 text-red-400 shadow-red-500/10'
        }`}>
          <Zap className={`w-6 h-6 ${proposal.action === 'BUY' ? 'fill-green-400' : 'fill-red-400'}`} />
          <span className="text-2xl font-black tracking-widest italic uppercase">
            {proposal.action || 'HOLD'}
          </span>
        </div>
      </div>

      {/* Interactive Tabs Section */}
      <Tabs defaultValue="numbers" className="w-full">
        <TabsList className="grid grid-cols-4 w-full bg-slate-900/80 border border-white/5 p-1.5 mb-10 rounded-2xl h-auto shadow-2xl backdrop-blur-md">
          <TabsTrigger value="numbers" className="py-3.5 rounded-xl data-[state=active]:bg-gradient-purple-cyan data-[state=active]:text-white data-[state=active]:shadow-lg transition-all font-bold text-xs md:text-sm">
            THE NUMBERS
          </TabsTrigger>
          <TabsTrigger value="logic" className="py-3.5 rounded-xl data-[state=active]:bg-gradient-purple-cyan data-[state=active]:text-white data-[state=active]:shadow-lg transition-all font-bold text-xs md:text-sm">
            THE LOGIC
          </TabsTrigger>
          <TabsTrigger value="evidence" className="py-3.5 rounded-xl data-[state=active]:bg-gradient-purple-cyan data-[state=active]:text-white data-[state=active]:shadow-lg transition-all font-bold text-xs md:text-sm">
            THE EVIDENCE
          </TabsTrigger>
          <TabsTrigger value="execute" className="py-3.5 rounded-xl data-[state=active]:bg-gradient-to-r from-amber-500 to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all font-black text-xs md:text-sm">
            EXECUTE
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Dữ liệu tài chính (Từ Proposal) */}
        <TabsContent value="numbers" className="mt-0 focus-visible:outline-none">
          <TheNumbers 
            currentValue={proposal.financialImpact?.currentValue || 0}
            projectedValue={proposal.financialImpact?.projectedValue || 0}
            percentChange={proposal.financialImpact?.percentChange || 0}
            tokenSymbol={proposal.tokenSymbol}
          />
        </TabsContent>

        {/* Tab 2: Logic AI (Từ Proposal) */}
        <TabsContent value="logic" className="mt-0 focus-visible:outline-none">
          <TheLogic 
            reason={proposal.reason || []} 
            rationaleSummary={proposal.summary || ''} 
            confidence={proposal.confidence || 0} 
          />
        </TabsContent>

        {/* Tab 3: Bằng chứng thị trường (Từ Signal API) */}
        <TabsContent value="evidence" className="mt-0 focus-visible:outline-none">
          <TheEvidence 
            signalData={signal} 
            tokenSymbol={proposal.tokenSymbol} 
          />
        </TabsContent>

        {/* Tab 4: Thực thi & Rủi ro (Từ Proposal) */}
        <TabsContent value="execute" className="mt-0 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <RiskSimulation 
                targetPrice={proposal.financialImpact?.projectedValue || 0}
                currentPrice={proposal.financialImpact?.currentValue || 0}
                potentialReturn={proposal.financialImpact?.percentChange || 0}
                suggestedAmount={100}
                action={proposal.action}
              />
            </div>
            
            {/* Sidebar Execution Status */}
            <div className="space-y-6">
              <div className="glass-card p-6 border border-white/5 rounded-2xl bg-slate-900/40">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
                  Wallet Status
                </h4>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">Connected</span>
                  <span className={`text-xs font-bold ${connected ? 'text-green-400' : 'text-red-400'}`}>
                    {connected ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Risk Profile</span>
                  <span className="text-xs font-bold text-amber-400">{proposal.financialImpact?.riskLevel || 'MEDIUM'}</span>
                </div>
              </div>

              <div className="p-1 rounded-2xl bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500">
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