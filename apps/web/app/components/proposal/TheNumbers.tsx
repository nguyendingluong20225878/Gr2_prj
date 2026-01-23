import { TrendingUp, DollarSign } from 'lucide-react';

interface TheNumbersProps {
  currentValue: number;
  projectedValue: number;
  percentChange?: number;
  tokenSymbol: string;
}

export function TheNumbers({ currentValue, projectedValue, percentChange, tokenSymbol }: TheNumbersProps) {
  const roi = projectedValue - currentValue;
  const roiPercent = percentChange !== undefined ? percentChange : (currentValue !== 0 ? (roi / currentValue) * 100 : 0);
  const isPositive = roiPercent > 0;

  const formatCurrency = (num: number) => {
    if (num === undefined || num === null) return '$0.00';
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const maxValue = Math.max(currentValue, projectedValue) || 1;
  const currentWidthPercent = Math.min((currentValue / maxValue) * 100, 100);
  const projectedWidthPercent = Math.min((projectedValue / maxValue) * 100, 100);

  return (
    <div className="glass-card rounded-xl p-6 border border-purple-400/30">
      <div className="flex items-center gap-2 mb-6">
        <DollarSign className="w-6 h-6 text-purple-400" />
        <h2 className="text-2xl font-bold gradient-text">The Numbers</h2>
      </div>

      <p className="text-sm text-slate-400 mb-8">
        Financial analysis for {tokenSymbol} based on AI prediction
      </p>

      {/* ROI Display */}
      <div className="bg-slate-900/50 border-2 border-cyber-cyan/30 rounded-xl p-6 mb-6 relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-32 h-32 ${isPositive ? 'bg-green-500/20' : 'bg-red-500/20'} blur-3xl`} />
        <div className="relative text-center">
          <p className="text-sm text-slate-400 mb-2">Expected ROI</p>
          <div className="flex items-baseline justify-center gap-3">
            <p className={`text-5xl font-bold font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{roiPercent.toFixed(2)}%
            </p>
            <TrendingUp className={`w-8 h-8 ${isPositive ? 'text-green-400' : 'text-red-400'}`} />
          </div>
          <p className={`text-xl font-semibold mt-2 ${isPositive ? 'text-green-400/70' : 'text-red-400/70'}`}>
            {isPositive ? '+' : ''}{formatCurrency(roi)}
          </p>
        </div>
      </div>

      {/* Comparison Bars */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Current Value</span>
            <span className="text-lg font-bold text-slate-200">{formatCurrency(currentValue)}</span>
          </div>
          <div className="h-4 bg-slate-800 rounded-full overflow-hidden relative">
            <div className="h-full bg-gradient-to-r from-slate-600 to-slate-500 rounded-full" style={{ width: `${currentWidthPercent}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Projected Value</span>
            <span className="text-lg font-bold text-cyber-cyan">{formatCurrency(projectedValue)}</span>
          </div>
          <div className="h-4 bg-slate-800 rounded-full overflow-hidden relative">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full animate-pulse" style={{ width: `${projectedWidthPercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}