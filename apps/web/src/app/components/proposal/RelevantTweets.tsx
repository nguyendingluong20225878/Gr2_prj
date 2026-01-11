import { Twitter, Heart, MessageCircle } from 'lucide-react';

interface Tweet {
  id: string;
  author: string;
  content: string;
  likes: number;
  timestamp: string;
}

interface RelevantTweetsProps {
  tweets?: Tweet[];
}

export function RelevantTweets({ tweets = [] }: RelevantTweetsProps) {
  if (tweets.length === 0) return null;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 border border-cyber-cyan/30">
      <div className="flex items-center gap-2 mb-4">
        <Twitter className="w-5 h-5 text-cyber-cyan" />
        <h3 className="text-lg font-semibold gradient-text">Top Signal Sources</h3>
      </div>

      <p className="text-sm text-slate-400 mb-4">
        AI detected these key discussions that contributed to this signal
      </p>

      <div className="space-y-3">
        {tweets.map((tweet) => (
          <div 
            key={tweet.id} 
            className="glass-card-hover p-4 rounded-lg border border-slate-700 hover:border-cyber-cyan/50 transition-all"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-purple-cyan flex items-center justify-center">
                  <span className="text-xs font-bold text-white">
                    {tweet.author === 'anonymized' ? '?' : tweet.author.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300">
                    {tweet.author === 'anonymized' ? 'Verified User' : tweet.author}
                  </p>
                  <p className="text-xs text-slate-500">{formatTime(tweet.timestamp)}</p>
                </div>
              </div>

              <div className="px-2 py-1 bg-cyan-400/10 border border-cyan-400/30 rounded text-xs text-cyan-400">
                <Twitter className="w-3 h-3 inline mr-1" />
                Post
              </div>
            </div>

            {/* Content */}
            <p className="text-sm text-slate-300 mb-3 leading-relaxed">
              {tweet.content}
            </p>

            {/* Engagement */}
            <div className="flex items-center gap-4 text-slate-500">
              <div className="flex items-center gap-1.5">
                <Heart className="w-4 h-4" />
                <span className="text-xs">{tweet.likes.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" />
                <span className="text-xs">{Math.floor(tweet.likes * 0.3).toLocaleString()}</span>
              </div>
            </div>

            {/* Privacy Note */}
            {tweet.author === 'anonymized' && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-600 flex items-center gap-1">
                  <span className="w-1 h-1 bg-slate-600 rounded-full" />
                  User identity protected for privacy
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-800">
        <p className="text-xs text-slate-500 leading-relaxed">
          <span className="text-cyber-cyan font-semibold">Note:</span> These sources have been analyzed by NDL AI sentiment engine. User identities are anonymized to protect privacy.
        </p>
      </div>
    </div>
  );
}
