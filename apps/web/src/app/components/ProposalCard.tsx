import React from "react";
import { ArrowRight, ShieldAlert, Target } from "lucide-react";

type Props = {
  proposal: any;
  onClick?: () => void;
};

export default function ProposalCard({ proposal, onClick }: Props) {
  const profit = proposal.financialImpact.projectedValue - proposal.financialImpact.currentValue;
  const isProfit = profit >= 0;

  return (
    <div 
        onClick={onClick}
        className="group relative p-5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] backdrop-blur-md transition-all cursor-pointer overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl -mr-10 -mt-10 transition group-hover:bg-blue-600/20"></div>

      <div className="relative z-10">
        {/* Header Card */}
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-white border border-white/5">
                    {proposal.tokenSymbol}
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg leading-tight">{proposal.title}</h3>
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <ShieldAlert size={10} /> Risk: {proposal.financialImpact.riskLevel}
                    </div>
                </div>
            </div>
            <div className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
                {proposal.confidence}% Win
            </div>
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-4"></div>

        {/* Stats Content */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <div className="text-xs text-slate-500 mb-1">Current Price</div>
                <div className="text-sm font-mono text-slate-300">${proposal.financialImpact.currentValue}</div>
            </div>
            <div className="text-right">
                <div className="text-xs text-slate-500 mb-1">Target</div>
                <div className="text-sm font-mono font-bold text-green-400 flex items-center justify-end gap-1">
                    <Target size={12} />
                    ${proposal.financialImpact.projectedValue}
                </div>
            </div>
        </div>

        {/* Action Button */}
        <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
             <div className={`text-sm font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                {isProfit ? '+' : ''}{profit.toFixed(2)} Profit
             </div>
             <button className="text-xs bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg transition flex items-center gap-2">
                View Details <ArrowRight size={12} />
             </button>
        </div>
      </div>
    </div>
  );
}