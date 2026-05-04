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
  finalWeight: number;  
};

// ==========================================
// 3. SHARED TYPES & SYSTEM CONFIG
// ==========================================

export type KnownTokenType = {
  address: string;
  symbol: string;
  name: string;
};

export type Source = {
  url: string;
  label: string;
};

export type SuggestionType = "buy" | "sell" | "hold" | "close_position" | "stake";

// ==========================================
// 4. FINAL OUTPUT (Tín hiệu cuối cùng lưu xuống DB)
// ==========================================

export interface QuantSignalResponse {
  signalDetected: boolean;
  tokenSymbol: string;
  tokenAddress?: string; 
  sources: Source[];
  
  // Các chỉ số chuẩn của V3
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

// Thêm vào types.ts
export interface DetectorParams {
  formattedTweets: FormattedTweet[]; // Dùng đúng Type V2 của bạn
  formattedNews: FormattedNews[];    // Dùng đúng Type V2 của bạn
  knownTokens: KnownTokenType[];
  historicalData?: Record<string, any[]>; 
}

// Interface dùng nội bộ trong V3 (Đã gom chung News & Tweet)
export interface ScoredDoc {
  tokenSymbol: string;
  directionScore: number;
  entropy: number;
  finalWeight: number;
  url: string;
  type: 'tweet' | 'news';
}

export interface TokenQuantState {
  symbol: string;
  unifiedRaw: number;
  volatilityFlag: number;
  timeZ?: number;
  pureAlphaZ?: number;
  crossZ?: number;
  finalScore?: number;
  sources: string[];
}