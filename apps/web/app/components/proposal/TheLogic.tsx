import { Brain, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';

interface TheLogicProps {
  reason: string[];
  rationaleSummary: string;
  confidence: number;
}

export function TheLogic({ reason = [], rationaleSummary, confidence }: TheLogicProps) {
  return (
    <div className="glass-card rounded-xl p-6 border border-cyan-400/30">
      <div className="flex items-center gap-2 mb-6">
        <Brain className="w-6 h-6 text-cyan-400" />
        <h2 className="text-2xl font-bold gradient-text">The Logic</h2>
      </div>

      {/* Confidence Meter */}
      <div className="bg-gradient-to-r from-purple-900/20 to-cyan-900/20 border border-cyan-500/30 rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-semibold text-slate-200">AI Confidence Score</span>
          </div>
          <span className="text-3xl font-bold text-cyan-400">{confidence}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.5)]" 
            style={{ width: `${confidence}%` }} 
          />
        </div>
      </div>

      {/* Executive Summary */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-5 mb-6 relative">
        <div className="absolute -left-1 top-6 w-1 h-8 bg-purple-500 rounded-r"></div>
        <p className="text-xs font-bold text-purple-400 mb-2 uppercase tracking-wider">Executive Summary</p>
        <p className="text-sm text-slate-300 leading-relaxed italic">
          "{rationaleSummary || 'AI did not provide a specific summary for this logic path.'}"
        </p>
      </div>

      {/* Bullet Points */}
      <div>
        <p className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-2">
           <AlertCircle className="w-3 h-3" /> Key Drivers
        </p>
        <div className="space-y-3">
          {reason.length > 0 ? reason.map((point, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-slate-900/30 rounded-lg border border-slate-800 hover:bg-slate-800/50 transition-colors">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mt-0.5">
                <CheckCircle2 className="w-3 h-3 text-green-400" />
              </div>
              <p className="text-sm text-slate-300 leading-snug">{point}</p>
            </div>
          )) : (
            <p className="text-sm text-slate-500 italic px-2">No detailed reasoning points available.</p>
          )}
        </div>
      </div>
    </div>
  );
}