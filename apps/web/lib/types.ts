// Shared frontend types mirroring backend schemas in core

/* =======================
   COMMON ENUMS
======================= */

export type SentimentType = 'positive' | 'negative' | 'neutral';
export type SuggestionType =
  | 'buy'
  | 'sell'
  | 'hold'
  | 'stake'
  | 'close_position';

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'executed' | 'expired';

/* =======================
   SIGNAL
======================= */

export interface SignalSource {
  label: string;
  url: string;
}

export interface Signal {
  _id?: string;
  tokenAddress: string;
  detectedAt: string; // ISO
  sources: SignalSource[];
  sentimentType: SentimentType;
  suggestionType: SuggestionType;
  confidence: number;
  rationaleSummary: string;
  expiresAt: string; // ISO
}

/* =======================
   BACKEND MIRROR (FE SAFE)
======================= */

/**
 * Proposal as returned from API
 * (mirror backend schema, mongoose stripped)
 */
export interface Proposal {
  _id: string;

  triggerEventId?: string;
  userId?: string;

  title: string;
  summary: string;
  reason: string[];

  // Backend lưu source dạng object
  sources: {
    name?: string;
    url?: string;
  }[];

  type?: 'trade' | 'stake' | 'risk' | 'opportunity';
  proposedBy?: string;

  financialImpact?: {
    currentValue?: number;
    projectedValue?: number;
    percentChange?: number;
    roi?: number;
    timeFrame?: string;
    riskLevel?: string;
  };

  expiresAt: string | Date;
  createdAt: string | Date;
  updatedAt?: string | Date;

  status: string; // Cho phép string để linh hoạt hơn
}

/* =======================
   UI / SOCIAL EXTENSION (QUAN TRỌNG)
======================= */

/**
 * Đây là Interface mà ProposalCardSocial.tsx sử dụng.
 * Chúng ta Omit (loại bỏ) các trường từ Proposal gốc để định nghĩa lại cho phù hợp với UI.
 */
export interface ProposalUI extends Omit<Proposal, 'financialImpact' | 'sources'> {
  
  // 1. Cập nhật Action: Thêm 'HOLD' để khớp với logic API
  action: 'BUY' | 'SELL' | 'HOLD';

  sentimentType: SentimentType;
  sentimentScore: number; // -100 → 100

  // 2. Token Info: Bắt buộc phải có để hiển thị
  tokenSymbol: string;
  tokenName: string;

  confidence: number; // 0–100
  socialScore?: number;

  // 3. Override Sources: UI chỉ cần mảng string URL cho đơn giản
  sources?: string[];

  // 4. Override Financial: Bắt buộc có dữ liệu để tính ROI
  financialImpact: {
    currentValue: number;
    projectedValue: number;
    percentChange?: number;
    roi?: number;
    timeFrame?: string;
    // Thêm | string để tránh lỗi nếu DB lưu "Low" thường
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | string; 
  };
}

/* =======================
   TOKEN PRICE
======================= */

export interface TokenPrice {
  tokenAddress: string;
  priceUsd: string | number;
  lastUpdated: string; // ISO
}

/* =======================
   SOCIAL
======================= */

export interface Tweet {
  _id?: string;
  authorId: string;
  url: string;
  content: string;
  retweetCount?: number | null;
  replyCount?: number | null;
  likeCount?: number | null;
  tweetTime: string; // ISO
}

/* =======================
   API REQUESTS
======================= */

export interface TriggerProposalRequest {
  signalId: string;
  userId: string;
}
