'use client';

import { useState, useEffect, useRef } from 'react';
import { Slider } from '@/app/components/ui/slider'; // Đảm bảo đã import đúng
import { Button } from '@/app/components/ui/button';
import { Wallet, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts/AuthContext'; // Cần User ID
import { useRouter } from 'next/navigation';
import { useTradingDemoStore, type DemoAlertSeverity, type DemoTradeAction } from '@/app/contexts/TradingDemoContext';

interface RiskSimulationProps {
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
  recommendation: string; 
  roi: number;
  initialAmount?: number;
  maxAmount?: number;
  maxLossUsd?: number;
  riskPerTradePct?: number;
  stopLossPct?: number;
  // Thêm các props cần thiết để lưu DB
  tokenSymbol?: string;
  proposalId?: string;
  executeNonce?: number;
  confidence?: number;
  quantScore?: number;
  riskLevel?: string;
  onExecutingChange?: (executing: boolean) => void;
}

export function RiskSimulation({ 
  currentPrice, 
  targetPrice, 
  stopLoss, 
  recommendation,
  roi = 0,
  initialAmount = 100,
  maxAmount = 5000,
  maxLossUsd,
  riskPerTradePct,
  stopLossPct,
  tokenSymbol = 'TOKEN',
  proposalId,
  executeNonce = 0,
  confidence = 0,
  quantScore,
  riskLevel = 'MEDIUM',
  onExecutingChange
}: RiskSimulationProps) {
  
  const { user } = useAuth(); // Lấy User đang đăng nhập
  const router = useRouter();
  const { executeProposal } = useTradingDemoStore();
  const [amount, setAmount] = useState<number>(initialAmount);
  const [projectedProfit, setProjectedProfit] = useState<number>(0);
  const [executing, setExecuting] = useState(false);
  const handledNonceRef = useRef(0);

  const setExecutionState = (value: boolean) => {
    setExecuting(value);
    onExecutingChange?.(value);
  };

  useEffect(() => {
    const profit = amount * (roi / 100);
    setProjectedProfit(profit);
  }, [amount, roi]);

  useEffect(() => {
    setAmount(initialAmount);
  }, [initialAmount]);

  // --- HÀM EXECUTE DEMO + BEST-EFFORT BACKEND SYNC ---
  const handleExecute = async () => {
    if (!proposalId) {
      toast.error("Proposal is missing. Cannot create demo order.");
      return;
    }
    if (executing) return;

    setExecutionState(true);
    const action: DemoTradeAction = recommendation === 'SELL' ? 'SELL' : 'BUY';
    const normalizedRisk = ['LOW', 'MEDIUM', 'HIGH'].includes(riskLevel.toUpperCase())
      ? riskLevel.toUpperCase() as DemoAlertSeverity
      : 'MEDIUM';

    try {
      const order = executeProposal({
        action,
        confidence,
        currentPrice,
        maxLossUsd,
        proposalId,
        quantScore,
        riskLevel: normalizedRisk,
        riskPerTradePct,
        roi,
        sizeUsd: amount,
        stopLossPct,
        targetPrice,
        tokenSymbol,
      });

      if (order.duplicate) {
        toast.info(`Local demo position for ${tokenSymbol} already exists. Opening positions workspace.`);
        window.setTimeout(() => router.push('/positions'), 350);
        return;
      }

      toast.success(`Local demo order ${order.id.slice(0, 12)} queued. Filling position...`);

      if (user?.walletAddress) {
        const res = await fetch('/api/trade/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user._id,
            walletAddress: user.walletAddress,
            proposalId: proposalId,
            tokenSymbol: tokenSymbol,
            tokenAddress: 'So11111111111111111111111111111111111111112',
            amount: amount,
            entryPrice: currentPrice,
            direction: recommendation === 'SELL' ? 'SHORT' : 'LONG',
            leverage: 1,
            riskPlan: {
              maxLossUsd,
              riskPerTradePct,
              stopLossPct,
              recommendedSizeUsd: initialAmount,
            },
          })
        });

        if (!res.ok) {
          const data = await res.json() as { error?: string };
          toast.warning(`Backend sync unavailable, local demo remains active: ${data.error || 'sync failed'}`);
        }
      }
      
      // Chuyển hướng sang workspace quản lý lệnh sau khi execute
      window.setTimeout(() => router.push('/positions'), 1100);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to execute';
      toast.error(`Demo execution failed: ${message}`);
    } finally {
      setExecutionState(false);
    }
  };

  useEffect(() => {
    if (executeNonce > 0 && executeNonce !== handledNonceRef.current) {
      handledNonceRef.current = executeNonce;
      handleExecute();
    }
  }, [executeNonce]);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* ... (Phần UI Slider giữ nguyên) ... */}
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <Wallet size={16} className="text-purple-400" /> Position Size
          </label>
          <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-300 font-mono font-bold">
            ${amount.toLocaleString()}
          </div>
        </div>
        
        <Slider
          value={[amount]}
          max={Math.max(maxAmount, 50)}
          step={50}
          onValueChange={(val) => setAmount(val[0])}
          className="py-4"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>$0</span>
          <span>${Math.max(maxAmount, 50).toLocaleString()}</span>
        </div>
      </div>

      {(maxLossUsd !== undefined || riskPerTradePct !== undefined || stopLossPct !== undefined) && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/5 bg-black/30 p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Risk</p>
            <p className="mt-1 text-sm font-mono text-amber-300">{riskPerTradePct?.toFixed(1) ?? 'n/a'}%</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black/30 p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Stop</p>
            <p className="mt-1 text-sm font-mono text-red-300">{stopLossPct?.toFixed(1) ?? 'n/a'}%</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black/30 p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Max loss</p>
            <p className="mt-1 text-sm font-mono text-slate-200">${(maxLossUsd ?? 0).toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="glass-card p-4 rounded-xl border border-green-500/30 bg-green-500/5">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs uppercase font-bold text-green-400">Estimated Profit</span>
          <span className="text-xs font-mono text-slate-400">ROI: {roi.toFixed(2)}%</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-green-300">
            {projectedProfit >= 0 ? '+' : '-'}${Math.abs(projectedProfit).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          <span className="text-xs text-green-500/70">USD</span>
        </div>
      </div>

      <Button 
        onClick={handleExecute} // Gọi hàm thật
        disabled={executing}
        className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-lg shadow-lg shadow-green-900/20"
      >
        {executing ? (
          <span className="flex items-center gap-2"><Loader2 className="animate-spin" /> Processing...</span>
        ) : (
          <span className="flex items-center gap-2">Vào lệnh <ArrowRight size={18} /></span>
        )}
      </Button>
    </div>
  );
}
