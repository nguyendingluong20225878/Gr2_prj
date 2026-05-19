// ==========================================
// 1. RAW DATA INPUTS (Dữ liệu thô từ Scraper)
// ==========================================

export type FormattedTweet = {
  id: string;
  text: string;
  author: string;
  time: string; // ISO timestamp
  url?: string;
  // Engagement signals từ DB (dùng để tính trọng số)
  replyCount?: number | null;
  retweetCount?: number | null;
  likeCount?: number | null;
  // AuthorWeight tính từ độ uy tín của tài khoản
  authorWeight?: number;
};

export type FormattedNews = {
  siteUrl: string;
  articleUrl: string;
  title: string;
  summary: string;
  content: string;
  publishedAt: Date | null;
  scrapedAt: Date;
  detectedTokens: string[];
};

// ==========================================
// 2. PRE-SCORED EVIDENCE (Dữ liệu đã qua API FinBERT & Weighting)
// ==========================================

export type PreScoredEvidence = {
  tweetId: string;
  tokenKey: string;
  zScore: number;      
  rawScore?: number;    
  finalWeight: number; 
  url?: string;
};

export type PreScoredNewsEvidence = {
  tokenKey: string; 
  articleUrl: string;
  zScore: number;       
  rawScore?: number;
};

// ==========================================
// 3. DICTIONARY & ENUMS
// ==========================================

export type KnownTokenType = {
  symbol: string;
  name: string;
  address?: string;
};

export type Source = {
  url: string;
  label: string;
  sourceKey?: string;
  weight?: number;
};

export type SuggestionType = "buy" | "sell" | "hold" | "close_position" | "stake";

// ==========================================
// 4. HYPERPARAMETERS (Config để Backtest/HPO tối ưu)
// ==========================================

export interface DetectorHyperParams {
  tweetHalfLifeHours: number;
  newsHalfLifeHours: number;
  maxWeightPerUser: number;
  newsBaseWeight: number;
  betaToBtc: number;
  alphaBlend: number;
  signalThreshold: number;
  actionThreshold: number;
  confidenceDivisor: number;
  coldStartConfidenceDivisor: number;
}

export const DEFAULT_HYPER_PARAMS: DetectorHyperParams = {
  tweetHalfLifeHours: 4,
  newsHalfLifeHours: 24,
  maxWeightPerUser: 5,//trọng số tối đa của một user có thể đóng góp vào tín hiệu 
  newsBaseWeight: 2,//trọng số cơ bản cho một bài báo/tweets khi quant
  betaToBtc: 0.75,//hệ số điều chỉnh để chuyển từ beta (tín hiệu tổng hợp) sang BTC (điểm tín hiệu cuối cùng)
  alphaBlend: 0.7,//hệ số để blend giữa tín hiệu độc lập và tín hiệu khác
  signalThreshold: 0.5,//ngưỡng để xác định có tín hiệu hay không (ví dụ: nếu điểm tín hiệu > 0.5 thì coi là có tín hiệu)
  actionThreshold: 1.5,//ngưỡng để xác định có nên đưa ra gợi ý hành động hay không (ví dụ: nếu điểm tín hiệu > 1.5 thì mới gợi ý buy/sell)
  confidenceDivisor: 3,//hệ số để chia điểm tín hiệu khi tính confidence (ví dụ: confidence = finalScore / confidenceDivisor)
  coldStartConfidenceDivisor: 5,//hệ số để chia điểm tín hiệu khi tính confidence trong trường hợp cold start (ít dữ liệu) (ví dụ: confidence = finalScore / coldStartConfidenceDivisor)
};

function positiveOrFallback(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function ratioOrFallback(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Number(value), 0), 1);
}

export function resolveHyperParams(
  overrides?: Partial<DetectorHyperParams>
): DetectorHyperParams {
  return {
    tweetHalfLifeHours: positiveOrFallback(
      overrides?.tweetHalfLifeHours,
      DEFAULT_HYPER_PARAMS.tweetHalfLifeHours
    ),
    newsHalfLifeHours: positiveOrFallback(
      overrides?.newsHalfLifeHours,
      DEFAULT_HYPER_PARAMS.newsHalfLifeHours
    ),
    maxWeightPerUser: positiveOrFallback(
      overrides?.maxWeightPerUser,
      DEFAULT_HYPER_PARAMS.maxWeightPerUser
    ),
    newsBaseWeight: positiveOrFallback(
      overrides?.newsBaseWeight,
      DEFAULT_HYPER_PARAMS.newsBaseWeight
    ),
    betaToBtc: Number.isFinite(overrides?.betaToBtc)
      ? Number(overrides?.betaToBtc)
      : DEFAULT_HYPER_PARAMS.betaToBtc,
    alphaBlend: ratioOrFallback(
      overrides?.alphaBlend,
      DEFAULT_HYPER_PARAMS.alphaBlend
    ),
    signalThreshold: positiveOrFallback(
      overrides?.signalThreshold,
      DEFAULT_HYPER_PARAMS.signalThreshold
    ),
    actionThreshold: positiveOrFallback(
      overrides?.actionThreshold,
      DEFAULT_HYPER_PARAMS.actionThreshold
    ),
    confidenceDivisor: positiveOrFallback(
      overrides?.confidenceDivisor,
      DEFAULT_HYPER_PARAMS.confidenceDivisor
    ),
    coldStartConfidenceDivisor: positiveOrFallback(
      overrides?.coldStartConfidenceDivisor,
      DEFAULT_HYPER_PARAMS.coldStartConfidenceDivisor
    ),
  };
}

// ==========================================
// 3. FINAL OUTPUT (Tín hiệu cuối cùng lưu xuống DB)
// ==========================================

export interface QuantSignalResponse {
  signalDetected: boolean;
  tokenSymbol: string;
  tokenAddress?: string; 
  sources: Source[]; // Bằng chứng (Evidence) cho LLM trích dẫn
  
  quantScore: number;       
  volatilityFlag: number;   
  sentimentType: "positive" | "negative" | "neutral";
  
  suggestionType: SuggestionType;
  confidence: number;
  rationaleSummary: string;
  relatedTweetIds?: string[];
  metadata?: any;
}

// ==========================================
// QUANT V3 INTERNAL PIPELINE TYPES
// ==========================================

export interface DetectorParams {
  formattedTweets: FormattedTweet[]; 
  formattedNews: FormattedNews[];    
  knownTokens: KnownTokenType[];
  historicalData?: Record<string, any[]>; 
  hyperParams?: Partial<DetectorHyperParams>;
  asOf?: Date;
  throttleMs?: number;
  chunkDelayMs?: number;
}

export interface ScoredDoc {
  tokenSymbol: string;
  tokenAddress: string; 
  directionScore: number;
  entropy: number;
  finalWeight: number;
  url: string;
  type: 'tweet' | 'news';
  sourceKey: string;
  author?: string;
  publishedAt: Date;
}//sau khi trích xuất và tính điểm 

export interface TokenQuantState {
  symbol: string;
  tokenAddress: string; 
  docsCount: number;
  unifiedRaw: number;
  avgEntropy: number;
  sources: Source[]; 
  timeZ?: number;
  pureAlphaZ?: number;
  crossZ?: number;
  finalScore?: number;
}
