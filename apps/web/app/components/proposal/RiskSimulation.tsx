'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';

interface RiskSimulationProps {
  targetPrice: number;
  currentPrice: number;
  potentialReturn: number;
  suggestedAmount: number;
  action?: string;
  onAmountChange?: (amount: number) => void;
}

export function RiskSimulation({ 
  targetPrice, currentPrice, potentialReturn, suggestedAmount, action
}: RiskSimulationProps) {
  const [amount, setAmount] = useState(suggestedAmount);
  const [executing, setExecuting] = useState(false);

  // Cập nhật state nếu props thay đổi
  useEffect(() => {
    if (suggestedAmount) setAmount(suggestedAmount);
  }, [suggestedAmount]);

  // Logic tính toán cơ bản
  const profitPercent = Math.abs(potentialReturn) / 100;
  const potentialProfit = amount * profitPercent;
  // Giả định mức cắt lỗ (Stoploss) là 15% cho mô phỏng
  const maxLoss = amount * 0.15; 
  
  const handleExecute = () => {
    setExecuting(true);
    // Giả lập call API execute trade
    setTimeout(() => {
        setExecuting(false);
        toast.success(`Lệnh ${action || 'TRADE'} $${amount} đã được gửi lên hệ thống!`);
    }, 2000);
  };

  return (
    <div className="space-y-6">
       {/* Simulation Card */}
      <div className="glass-card rounded-xl p-6 border border-purple-400/30 bg-slate-900/40">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-slate-200">Risk Simulator</h3>
        </div>

        <div className="mb-8">
          <div className="flex justify-between mb-4">
            <span className="text-sm text-slate-400">Vốn đầu tư (USDC)</span>
            <div className="flex items-center gap-1">
              <span className="text-xl font-bold text-white">$</span>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="bg-transparent text-xl font-bold text-white w-24 text-right border-b border-slate-700 focus:border-cyan-400 outline-none"
              />
            </div>
          </div>

          {/* Custom Range Slider using Tailwind */}
          <div className="relative w-full h-6 flex items-center">
            <input 
              type="range" 
              min="10" 
              max="2000" 
              step="10"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
            />
          </div>

          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>Min: $10</span>
            <span>Max: $2000</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Profit Box */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 transition-all hover:bg-green-500/20">
            <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-400 uppercase font-bold">Lợi nhuận mục tiêu</span>
            </div>
            <p className="text-2xl font-bold text-green-400">+${potentialProfit.toFixed(2)}</p>
            <p className="text-[10px] text-green-400/70 mt-1">ROI: {potentialReturn.toFixed(1)}%</p>
          </div>

          {/* Risk Box */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 transition-all hover:bg-red-500/20">
            <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-400 uppercase font-bold">Rủi ro tối đa</span>
            </div>
            <p className="text-2xl font-bold text-red-400">-${maxLoss.toFixed(2)}</p>
            <p className="text-[10px] text-red-400/70 mt-1">Stoploss: -15%</p>
          </div>
        </div>
      </div>

      {/* Execute Button Section */}
      <div className="glass-card p-6 border border-white/10 text-center bg-gradient-to-b from-slate-900/50 to-black/50">
         <p className="text-xs text-slate-400 mb-4 italic">
            Bằng việc thực thi, bạn đồng ý với các quy tắc quản lý vốn tự động của AI.
         </p>
         <Button 
            onClick={handleExecute} 
            disabled={executing}
            className="w-full py-6 text-lg bg-gradient-purple-cyan hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all font-bold text-white border-0"
         >
            {executing ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang xử lý giao dịch...</>
            ) : (
                <><Zap className="mr-2 h-5 w-5 fill-white" /> EXECUTE {action || 'ORDER'}</>
            )}
         </Button>
      </div>
    </div>
  );
}