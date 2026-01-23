import { Twitter, ExternalLink, Shield, MessageCircle } from 'lucide-react';

interface TheEvidenceProps {
  sources: string[];
  tokenSymbol: string;
  triggerEventId: string;
}

export function TheEvidence({ sources = [], tokenSymbol, triggerEventId }: TheEvidenceProps) {
  const shortenUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.length > 15 ? urlObj.pathname.slice(0, 15) + '...' : urlObj.pathname;
      return `${urlObj.hostname}${path}`;
    } catch { return url; }
  };

  return (
    <div className="glass-card rounded-xl p-6 border border-green-400/30">
      <div className="flex items-center gap-2 mb-6">
        <Twitter className="w-6 h-6 text-green-400" />
        <h2 className="text-2xl font-bold gradient-text">The Evidence</h2>
      </div>

      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-cyan-400">SIGNAL ID</span>
        </div>
        <p className="text-sm text-slate-300">Proposal linked to: <span className="font-mono text-cyan-400">{triggerEventId}</span></p>
      </div>

      <div>
        <p className="text-xs font-semibold text-green-400 mb-4 uppercase tracking-wider">Verified Sources ({sources.length}):</p>
        {sources.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 text-center">
            <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No public sources link available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((source, index) => (
              <div key={index} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                    <Twitter className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 mb-2 font-mono break-all truncate">{shortenUrl(source)}</p>
                    <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md text-xs text-slate-300 hover:text-cyan-400 transition-all">
                      <ExternalLink className="w-3 h-3" /> <span>Open Link</span>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}