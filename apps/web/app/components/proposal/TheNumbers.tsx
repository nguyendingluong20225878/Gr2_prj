import { TrendingUp, DollarSign, Wallet } from 'lucide-react';

interface TheNumbersProps {
  currentValue: number;
  projectedValue: number;
  percentChange?: number;
  roi?: number; // Nhận thêm prop roi
  tokenSymbol: string;
}

export function TheNumbers({ currentValue, projectedValue, percentChange, roi, tokenSymbol }: TheNumbersProps) {
  // Ưu tiên lấy ROI từ prop, nếu không có mới tính toán
  let displayRoi = 0;
  if (roi !== undefined) displayRoi = roi;
  else if (percentChange !== undefined) displayRoi = percentChange;
  else if (currentValue > 0) displayRoi = ((projectedValue - currentValue) / currentValue) * 100;

  const isPositive = displayRoi >= 0;

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const diffValue = projectedValue - currentValue;

  // === FIX PROGRESS BAR LOGIC ===
  // Tính tỷ lệ phần trăm chiều rộng cho từng thanh
  // Tổng thanh = Projected Value (hoặc Current Value nếu lỗ)
  const maxValue = Math.max(currentValue, projectedValue);
  const currentWidth = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
  const gainWidth = maxValue > 0 ? (Math.abs(diffValue) / maxValue) * 100 : 0;

  return (
    <div className="glass-card rounded-xl p-6 border border-purple-400/30 bg-slate-950/50">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-bold gradient-text flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-purple-400" /> The Numbers
          </h2>
          <p className="text-xs text-slate-500 uppercase mt-1">Personalized Financial Impact</p>
        </div>
        <div className={`text-right ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          <p className="text-4xl font-black font-mono leading-none tracking-tight">
            {isPositive ? '+' : ''}{displayRoi.toFixed(2)}%
          </p>
          <div className="flex items-center justify-end gap-1 mt-1">
             <TrendingUp className={`w-3 h-3 ${isPositive ? '' : 'rotate-180'}`} />
             <p className="text-[10px] uppercase font-bold tracking-widest">Est. ROI</p>
          </div>
        </div>
      </div>

      {/* Cards Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="p-5 bg-slate-900/60 rounded-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10"><Wallet className="w-12 h-12 text-white" /></div>
          <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Current Allocation</p>
          <p className="text-2xl font-bold text-white font-mono">{formatCurrency(currentValue)}</p>
        </div>
        
        <div className={`p-5 rounded-xl border relative overflow-hidden ${isPositive ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <div className={`absolute top-0 right-0 p-3 opacity-10 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            <TrendingUp className="w-12 h-12" />
          </div>
          <p className={`text-xs uppercase font-semibold mb-2 ${isPositive ? 'text-green-500/70' : 'text-red-500/70'}`}>
            Projected Value
          </p>
          <p className={`text-2xl font-bold font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(projectedValue)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Based on AI prediction</p>
        </div>
      </div>

      {/* Progress Bar Visualization */}
      <div className="space-y-2">
        <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 px-1">
          <span>Current</span>
          <span>Target ({isPositive ? '+' : ''}{formatCurrency(diffValue)})</span>
        </div>
        
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden flex p-0.5 border border-slate-700 relative">
          {/* Base Bar (Current) */}
          <div 
            className="h-full bg-slate-500 rounded-l-full transition-all duration-1000" 
            style={{ width: `${currentWidth}%` }}
          />
          
          {/* Gain Bar (Target) */}
          {isPositive && (
             <div 
               className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-r-full animate-pulse ml-0.5 transition-all duration-1000" 
               style={{ width: `${gainWidth}%` }} 
             />
          )}
        </div>
      </div>
    </div>
  );
}