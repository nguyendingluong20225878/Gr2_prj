'use client';

import { useState, useEffect } from 'react';
import { Slider } from '@/app/components/ui/slider'; // Đảm bảo đã import đúng
import { Button } from '@/app/components/ui/button';
import { Wallet, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts/AuthContext'; // Cần User ID
import { useRouter } from 'next/navigation';

interface RiskSimulationProps {
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
  recommendation: string; 
  roi: number;
  // Thêm các props cần thiết để lưu DB
  tokenSymbol?: string;
  proposalId?: string;
}

export function RiskSimulation({ 
  currentPrice, 
  targetPrice, 
  stopLoss, 
  recommendation,
  roi = 0,
  tokenSymbol = 'TOKEN',
  proposalId
}: RiskSimulationProps) {
  
  const { user } = useAuth(); // Lấy User đang đăng nhập
  const router = useRouter();
  const [amount, setAmount] = useState<number>(100);
  const [projectedProfit, setProjectedProfit] = useState<number>(0);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    const profit = amount * (roi / 100);
    setProjectedProfit(profit);
  }, [amount, roi]);

  // --- HÀM EXECUTE THẬT ---
  const handleExecute = async () => {
    if (!user) {
      toast.error("Please login to trade!");
      return;
    }

    setExecuting(true);
    try {
      // Gọi API mà chúng ta vừa tạo ở Bước 1
      const res = await fetch('/api/trade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          proposalId: proposalId,
          tokenSymbol: tokenSymbol,
          tokenAddress: 'So11111111111111111111111111111111111111112', // Tạm fix address hoặc truyền từ prop
          amount: amount,
          entryPrice: currentPrice,
          direction: recommendation === 'SELL' ? 'SHORT' : 'LONG',
          leverage: 1
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to execute');

      toast.success("Trade Executed Successfully!");
      
      // Chuyển hướng sang Portfolio để xem kết quả
      router.push('/portfolio');

    } catch (error: any) {
      toast.error(`Trade Failed: ${error.message}`);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* ... (Phần UI Slider giữ nguyên) ... */}
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <Wallet size={16} className="text-purple-400" /> Investment Amount
          </label>
          <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-300 font-mono font-bold">
            ${amount.toLocaleString()}
          </div>
        </div>
        
        <Slider
          defaultValue={[100]}
          max={5000}
          step={50}
          onValueChange={(val) => setAmount(val[0])}
          className="py-4"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>$0</span>
          <span>$5,000</span>
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl border border-green-500/30 bg-green-500/5">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs uppercase font-bold text-green-400">Estimated Profit</span>
          <span className="text-xs font-mono text-slate-400">ROI: {roi.toFixed(2)}%</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-green-300">
            +${projectedProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
          <span className="flex items-center gap-2">EXECUTE TRADE <ArrowRight size={18} /></span>
        )}
      </Button>
    </div>
  );
}