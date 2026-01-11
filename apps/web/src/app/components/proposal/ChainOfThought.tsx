import { Clock, CheckCircle2, Twitter, Volume2, TrendingUp, Database } from 'lucide-react';

interface ChainStep {
  timestamp: string;
  event: string;
  source: string;
}

interface ChainOfThoughtProps {
  steps: ChainStep[];
}

export function ChainOfThought({ steps }: ChainOfThoughtProps) {
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'x-scraper':
        return { Icon: Twitter, color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30' };
      case 'volume-alert':
        return { Icon: Volume2, color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' };
      case 'technical-analysis':
        return { Icon: TrendingUp, color: 'text-green-400 bg-green-400/10 border-green-400/30' };
      case 'on-chain-data':
        return { Icon: Database, color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' };
      case 'social-spike':
        return { Icon: Twitter, color: 'text-pink-400 bg-pink-400/10 border-pink-400/30' };
      default:
        return { Icon: CheckCircle2, color: 'text-slate-400 bg-slate-400/10 border-slate-400/30' };
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="glass-card rounded-xl p-6 border border-cyber-purple/30">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-5 h-5 text-cyber-cyan" />
        <h3 className="text-lg font-semibold gradient-text">Chain of Thought Timeline</h3>
      </div>

      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyber-purple via-cyber-cyan to-cyber-purple opacity-30" />

        <div className="space-y-6">
          {steps.map((step, index) => {
            const { Icon, color } = getSourceIcon(step.source);
            
            return (
              <div key={index} className="relative pl-16">
                {/* Icon Circle */}
                <div className={`absolute left-0 w-12 h-12 rounded-full border ${color} flex items-center justify-center z-10`}>
                  <Icon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="glass-card-hover p-4 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-cyber-cyan">{formatTime(step.timestamp)}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">
                      {step.source.replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{step.event}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Final AI Decision */}
        <div className="relative pl-16 mt-6">
          <div className="absolute left-0 w-12 h-12 rounded-full bg-gradient-purple-cyan flex items-center justify-center z-10 neon-glow animate-pulse-glow">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <div className="glass-card p-4 rounded-lg border-2 border-cyber-cyan/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-green-400 font-semibold">AI PROPOSAL GENERATED</span>
            </div>
            <p className="text-sm text-green-400 font-medium">Ready for execution with high confidence score</p>
          </div>
        </div>
      </div>
    </div>
  );
}
