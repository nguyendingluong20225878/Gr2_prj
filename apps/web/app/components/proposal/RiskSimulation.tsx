import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
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
  targetPrice, 
  currentPrice, 
  potentialReturn,
  suggestedAmount,
  onAmountChange 
}: RiskSimulationProps) {
  const [amount, setAmount] = useState(suggestedAmount);

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setAmount(numValue);
    onAmountChange?.(numValue);
  };

  // Calculate profit/loss
  const potentialProfit = (amount * potentialReturn) / 100;
  const maxLoss = amount * 0.15; // Assume max 15% loss for risk calculation
  const targetValue = amount + potentialProfit;

  // Risk/Reward Ratio
  const riskRewardRatio = Math.abs(potentialProfit / maxLoss);

  return (
    <div className="glass-card rounded-xl p-6 border border-purple-400/30">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold gradient-text">Risk Simulation</h3>
      </div>

      <p className="text-sm text-slate-400 mb-6">
        Adjust investment amount to see potential outcomes
      </p>

      {/* Amount Slider */}
      <div className="space-y-4 mb-6">
        <div>
          <Label htmlFor="amount" className="text-slate-300 mb-2 block">
            Investment Amount (USD)
          </Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            className="bg-slate-900/50 border-slate-700 text-white text-lg font-semibold"
            placeholder="Enter amount"
            min="0"
            step="10"
          />
        </div>

        {/* Range Input */}
        <div className="relative">
          <input
            type="range"
            min="0"
            max={suggestedAmount * 3}
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyber-purple"
            style={{
              background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${(amount / (suggestedAmount * 3)) * 100}%, #1e293b ${(amount / (suggestedAmount * 3)) * 100}%, #1e293b 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>$0</span>
            <span className="text-cyber-cyan">Suggested: ${suggestedAmount}</span>
            <span>${suggestedAmount * 3}</span>
          </div>
        </div>
      </div>

      {/* Outcome Preview */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Profit Potential */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 blur-xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400">Profit Potential</span>
            </div>
            <p className="text-2xl font-bold text-green-400">
              +${potentialProfit.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              If target price ${targetPrice.toFixed(2)} is reached
            </p>
          </div>
        </div>

        {/* Max Loss */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 blur-xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400">Max Risk</span>
            </div>
            <p className="text-2xl font-bold text-red-400">
              -${maxLoss.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Estimated maximum downside
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="space-y-3 p-4 bg-slate-900/50 rounded-lg border border-slate-800">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">Current Investment</span>
          <span className="text-sm font-semibold text-white">${amount.toFixed(2)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">Target Value</span>
          <span className="text-sm font-semibold text-cyber-cyan">${targetValue.toFixed(2)}</span>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-slate-800">
          <span className="text-sm text-slate-400">Risk/Reward Ratio</span>
          <span className={`text-sm font-semibold ${riskRewardRatio >= 2 ? 'text-green-400' : riskRewardRatio >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
            1:{riskRewardRatio.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">Expected Return</span>
          <span className={`text-sm font-semibold ${potentialReturn > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {potentialReturn > 0 ? '+' : ''}{potentialReturn.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Risk Warning */}
      {amount > suggestedAmount * 1.5 && (
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-yellow-400 mb-1">High Risk Warning</p>
            <p className="text-xs text-slate-400">
              Investment exceeds AI recommended amount. Consider your risk tolerance before proceeding.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
