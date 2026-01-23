import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';

interface RiskSimulationProps {
  targetPrice: number;
  currentPrice: number;
  potentialReturn: number;
  suggestedAmount: number;
  onAmountChange?: (amount: number) => void;
}

export function RiskSimulation({ 
  targetPrice, currentPrice, potentialReturn, suggestedAmount, onAmountChange 
}: RiskSimulationProps) {
  const [amount, setAmount] = useState(suggestedAmount);

  useEffect(() => { setAmount(suggestedAmount); }, [suggestedAmount]);

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setAmount(numValue);
    onAmountChange?.(numValue);
  };

  const profitPercent = potentialReturn / 100;
  const potentialProfit = amount * profitPercent;
  const targetValue = amount + potentialProfit;
  const maxLoss = amount * 0.15; 
  const riskRewardRatio = maxLoss !== 0 ? Math.abs(potentialProfit / maxLoss) : 0;

  return (
    <div className="glass-card rounded-xl p-6 border border-purple-400/30">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold gradient-text">Risk Simulation</h3>
      </div>
      <p className="text-sm text-slate-400 mb-6">Based on Current Price: ${currentPrice?.toFixed(2)} → Target: ${targetPrice?.toFixed(2)}</p>

      <div className="space-y-4 mb-6">
        <div>
          <Label htmlFor="amount" className="text-slate-300 mb-2 block">Investment Amount (USD)</Label>
          <Input id="amount" type="number" value={amount} onChange={(e) => handleAmountChange(e.target.value)} className="bg-slate-900/50 border-slate-700 text-white text-lg font-semibold" min="0" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-green-400" /><span className="text-xs text-green-400">Potential Profit</span></div>
          <p className="text-2xl font-bold text-green-400">+${potentialProfit.toFixed(2)}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingDown className="w-4 h-4 text-red-400" /><span className="text-xs text-red-400">Max Risk (-15%)</span></div>
          <p className="text-2xl font-bold text-red-400">-${maxLoss.toFixed(2)}</p>
        </div>
      </div>

      <div className="space-y-3 p-4 bg-slate-900/50 rounded-lg border border-slate-800">
        <div className="flex justify-between items-center"><span className="text-sm text-slate-400">Target Value</span><span className="text-sm font-semibold text-cyber-cyan">${targetValue.toFixed(2)}</span></div>
        <div className="flex justify-between items-center"><span className="text-sm text-slate-400">Risk/Reward</span><span className="text-sm font-semibold text-yellow-400">1 : {riskRewardRatio.toFixed(2)}</span></div>
      </div>
    </div>
  );
}