import { TrendingUp, DollarSign } from 'lucide-react';

interface TheNumbersProps {
  currentValue: number;
  projectedValue: number;
  tokenSymbol: string;
}

export function TheNumbers({ currentValue, projectedValue, tokenSymbol }: TheNumbersProps) {
  const roi = projectedValue - currentValue;
  const roiPercent = ((roi / currentValue) * 100);
  const isPositive = roi > 0;

  // Format currency
  const formatCurrency = (num: number) => {
    if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `$${(num / 1_000).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  };

  // Calculate bar widths for visualization
  const maxValue = Math.max(currentValue, projectedValue);
  const currentWidthPercent = (currentValue / maxValue) * 100;
  const projectedWidthPercent = (projectedValue / maxValue) * 100;

  return (
    <div className="glass-card rounded-xl p-6 border border-purple-400/30">
      <div className="flex items-center gap-2 mb-6">
        <DollarSign className="w-6 h-6 text-purple-400" />
        <h2 className="text-2xl font-bold gradient-text">The Numbers</h2>
      </div>

      <p className="text-sm text-slate-400 mb-8">
        Financial analysis based on AI prediction model
      </p>

      {/* Big ROI Display */}
      <div className="bg-slate-900/50 border-2 border-cyber-cyan/30 rounded-xl p-6 mb-6 relative overflow-hidden">
        {/* Glow effect */}
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
            <div 
              className="h-full bg-gradient-to-r from-slate-600 to-slate-500 rounded-full"
              style={{ width: `${currentWidthPercent}%` }}
            />
            {/* Label inside bar */}
            <div className="absolute inset-0 flex items-center px-3">
              <span className="text-xs font-semibold text-white">Current</span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Projected Value</span>
            <span className="text-lg font-bold text-cyber-cyan">{formatCurrency(projectedValue)}</span>
          </div>
          <div className="h-4 bg-slate-800 rounded-full overflow-hidden relative">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full animate-pulse"
              style={{ width: `${projectedWidthPercent}%` }}
            />
            {/* Label inside bar */}
            <div className="absolute inset-0 flex items-center px-3">
              <span className="text-xs font-semibold text-white">Projected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-2 gap-4 mt-8">
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
          <p className="text-xs text-slate-500 mb-1">Entry Point</p>
          <p className="text-lg font-bold text-slate-200">{formatCurrency(currentValue)}</p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4 border border-cyan-500/30">
          <p className="text-xs text-slate-500 mb-1">Target</p>
          <p className="text-lg font-bold text-cyan-400">{formatCurrency(projectedValue)}</p>
        </div>

        <div className={`rounded-lg p-4 border-2 ${isPositive ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'}`}>
          <p className="text-xs text-slate-500 mb-1">Profit Potential</p>
          <p className={`text-lg font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{formatCurrency(roi)}
          </p>
        </div>

        <div className={`rounded-lg p-4 border-2 ${isPositive ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'}`}>
          <p className="text-xs text-slate-500 mb-1">ROI %</p>
          <p className={`text-lg font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{roiPercent.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}
