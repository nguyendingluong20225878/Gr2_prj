import { Twitter, ExternalLink, Shield, BarChart3, Radio, Loader2 } from 'lucide-react';

interface TheEvidenceProps {
  signalData: any; // Object Signal từ Backend
  tokenSymbol: string;
  overrideSources?: any[]; // [MỚI] Thêm prop này để nhận sources từ Proposal
}

export function TheEvidence({ signalData, tokenSymbol, overrideSources }: TheEvidenceProps) {
  // Helper rút gọn link
  const shortenUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return `x.com${urlObj.pathname.length > 20 ? urlObj.pathname.slice(0, 20) + '...' : urlObj.pathname}`;
    } catch { return 'Link External'; }
  };

  // Logic kiểm tra dữ liệu: Chỉ hiện Loading nếu không có cả Signal lẫn Sources đè (từ Proposal)
  // Nếu signalData chưa load xong nhưng đã có overrideSources (từ proposal) thì vẫn hiển thị được phần Sources.
  const isLoading = !signalData && (!overrideSources || overrideSources.length === 0);

  if (isLoading) {
    return (
      <div className="glass-card p-10 text-center border-dashed border-slate-700">
        <Loader2 className="w-8 h-8 text-slate-600 mx-auto animate-spin mb-2" />
        <p className="text-slate-500">Đang tải dữ liệu thị trường thực tế...</p>
      </div>
    );
  }

  // Xác định danh sách sources để hiển thị (Ưu tiên overrideSources)
  const displaySources = overrideSources && overrideSources.length > 0 
    ? overrideSources 
    : (signalData?.sources || []);

  return (
    <div className="glass-card rounded-xl p-6 border border-green-400/30">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Radio className="w-6 h-6 text-green-400 animate-pulse" />
          <h2 className="text-2xl font-bold gradient-text">Market Signal Evidence</h2>
        </div>
        
        {/* Chỉ hiển thị Sentiment nếu có signalData */}
        {signalData && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Sentiment</span>
            <span className={`text-lg font-bold uppercase ${signalData.sentimentType === 'positive' ? 'text-green-400' : 'text-red-400'}`}>
              {signalData.sentimentType || 'NEUTRAL'}
            </span>
          </div>
        )}
      </div>

      {/* Sentiment Context (Chỉ hiện nếu có signalData) */}
      {signalData && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
             <BarChart3 className="w-4 h-4 text-purple-400" />
             <span className="text-xs font-bold text-purple-400 uppercase">Signal Reason</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed italic">
            "{signalData.rationaleSummary || 'No summary available for this signal.'}"
          </p>
        </div>
      )}

      {/* Raw Sources List */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
           <Twitter className="w-3 h-3" /> Live Sources ({displaySources.length})
        </p>
        
        {displaySources.length === 0 ? (
          <div className="bg-slate-900/30 border border-dashed border-slate-700 rounded-lg p-6 text-center">
            <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No raw links found in database.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {displaySources.map((source: any, index: number) => {
              // Xử lý trường hợp source là string hoặc object
              const url = typeof source === 'string' ? source : source.url;
              const text = typeof source === 'string' ? '' : source.text;

              return (
                <div key={index} className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg hover:border-cyan-500/50 transition-colors group">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
                      <Twitter className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {text && <p className="text-xs text-slate-300 mb-1 line-clamp-2">"{text}"</p>}
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1 text-xs text-cyan-500 hover:text-cyan-300 transition-colors"
                      >
                         {shortenUrl(url)} <ExternalLink className="w-3 h-3 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}