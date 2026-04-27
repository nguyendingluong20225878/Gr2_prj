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
  sources: Source[];
  sentimentScore: number;
  suggestionType: SuggestionType;
  strength: number | null;
  confidence: number | null;
  reasoning: string;
  relatedTweetIds: string[];
  reasonInvalid?: string;
  impactScore: number | null;
}

// Params cho Orchestrator (Detector cũ)
export type DetectorParams = {
  formattedNews: FormattedNews[];
  formattedTweets: FormattedTweet[];
  knownTokens: KnownTokenType[];
};