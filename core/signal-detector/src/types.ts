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
};

export type SuggestionType = "buy" | "sell" | "hold" | "close_position" | "stake";

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
}

export interface ScoredDoc {
  tokenSymbol: string;
  tokenAddress: string; 
  directionScore: number;
  entropy: number;
  finalWeight: number;
  url: string;
  type: 'tweet' | 'news';
}

export interface TokenQuantState {
  symbol: string;
  tokenAddress: string; 
  docsCount: number;
  unifiedRaw: number;
  avgEntropy: number;
  // [FIX BUG 1]: Bổ sung mảng sources để lưu vết bằng chứng
  sources: Source[]; 
  timeZ?: number;
  pureAlphaZ?: number;
  crossZ?: number;
  finalScore?: number;
}