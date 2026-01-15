import { Brain, CheckCircle2, Sparkles } from 'lucide-react';

interface TheLogicProps {
  reason: string[];
  rationaleSummary: string;
  confidence: number;
}

export function TheLogic({ reason, rationaleSummary, confidence }: TheLogicProps) {
  return (
    <div className="glass-card rounded-xl p-6 border border-cyan-400/30">
      <div className="flex items-center gap-2 mb-6">
        <Brain className="w-6 h-6 text-cyan-400" />
        <h2 className="text-2xl font-bold gradient-text">The Logic</h2>
      </div>

      <p className="text-sm text-slate-400 mb-6">
        Why our AI recommends this trade
      </p>

      {/* Confidence Score */}
      <div className="bg-gradient-to-r from-cyber-purple/20 to-cyber-cyan/20 border border-cyber-cyan/30 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyber-cyan" />
            <span className="text-sm font-semibold text-slate-200">AI Confidence Score</span>
          </div>
          <span className="text-2xl font-bold text-cyber-cyan">{confidence}%</span>
        </div>
        
        {/* Progress bar */}
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyber-purple via-cyber-cyan to-cyber-purple rounded-full animate-pulse"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 mb-6">
        <p className="text-xs font-semibold text-purple-400 mb-2">EXECUTIVE SUMMARY</p>
        <p className="text-sm text-slate-300 leading-relaxed italic">
          "{rationaleSummary}"
        </p>
      </div>

      {/* Reason Bullets */}
      <div>
        <p className="text-xs font-semibold text-cyan-400 mb-4 uppercase tracking-wider">
          AI Analysis Points:
        </p>
        
        <div className="space-y-3">
          {reason.map((point, index) => (
            <div 
              key={index}
              className="flex items-start gap-3 p-3 bg-slate-900/30 rounded-lg border border-slate-800 hover:border-cyan-400/30 transition-all group"
            >
              {/* Checkmark */}
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center group-hover:bg-green-500/30 transition-all">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
              
              {/* Point text */}
              <div className="flex-1">
                <p className="text-sm text-slate-200 leading-relaxed">
                  {point}
                </p>
              </div>

              {/* Index number */}
              <div className="flex-shrink-0 w-6 h-6 rounded bg-slate-800 flex items-center justify-center">
                <span className="text-xs font-mono text-slate-500">{index + 1}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="text-yellow-400 font-semibold">⚠️ AI Analysis:</span> This analysis is based on social sentiment data from Twitter/X. While our AI processes thousands of signals, this is not financial advice. Please do your own research (DYOR) before making investment decisions.
        </p>
      </div>
    </div>
  );
}
