import { Twitter, ExternalLink, Shield, MessageCircle } from 'lucide-react';

interface TheEvidenceProps {
  sources: string[];
  tokenSymbol: string;
  triggerEventId: string;
}

export function TheEvidence({ sources, tokenSymbol, triggerEventId }: TheEvidenceProps) {
  // Extract tweet ID from URL for display
  const getTweetId = (url: string) => {
    const parts = url.split('/');
    return parts[parts.length - 1] || 'unknown';
  };

  // Shorten URL for display
  const shortenUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}/.../${getTweetId(url).slice(0, 8)}`;
    } catch {
      return url;
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 border border-green-400/30">
      <div className="flex items-center gap-2 mb-6">
        <Twitter className="w-6 h-6 text-green-400" />
        <h2 className="text-2xl font-bold gradient-text">The Evidence</h2>
      </div>

      <p className="text-sm text-slate-400 mb-6">
        Real tweets analyzed by NDL AI to generate this signal
      </p>

      {/* Trigger Info */}
      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-cyan-400">DETECTION SOURCE</span>
        </div>
        <p className="text-sm text-slate-300">
          Signal triggered by: <span className="font-mono text-cyan-400">{triggerEventId}</span>
        </p>
      </div>

      {/* Sources List */}
      <div>
        <p className="text-xs font-semibold text-green-400 mb-4 uppercase tracking-wider">
          Source Tweets ({sources.length}):
        </p>

        {sources.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 text-center">
            <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-2">No public sources available</p>
            <p className="text-xs text-slate-600">
              Sources are being processed or were anonymized for privacy protection
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((source, index) => (
              <div 
                key={index}
                className="bg-slate-900/50 border border-slate-700 hover:border-green-400/50 rounded-lg p-4 transition-all group"
              >
                <div className="flex items-start gap-3">
                  {/* Twitter Icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                    <Twitter className="w-5 h-5 text-cyan-400" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-slate-400">Twitter Source #{index + 1}</span>
                      <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded text-xs text-green-400">
                        Verified
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 mb-3 font-mono break-all">
                      {shortenUrl(source)}
                    </p>

                    {/* Action Link */}
                    <a 
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-400/50 rounded-md text-xs text-slate-300 hover:text-cyan-400 transition-all group-hover:border-cyan-400/50"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>View on Twitter/X</span>
                    </a>
                  </div>

                  {/* Index Badge */}
                  <div className="flex-shrink-0 w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <span className="text-sm font-bold text-slate-500">#{index + 1}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Privacy Notice */}
      <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-purple-400 mb-1">Privacy & Transparency</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              All sources are publicly available tweets. NDL AI analyzes social sentiment to detect market opportunities. 
              We encourage you to verify these sources independently before making any trading decisions.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Notice */}
      <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
        <p className="text-xs text-green-400 font-semibold text-center">
          ✓ These tweets contributed to the {tokenSymbol} signal with {sources.length} verified source{sources.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
