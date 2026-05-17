import mongoose, { Schema, Document } from "mongoose";

// Các loại suggestion
export const suggestionEnum = ["buy", "sell", "hold", "close_position", "stake"] as const;

// Schema cho source
export const sourceSchema = new Schema({
  url: { type: String, required: true },
  label: { type: String, required: true },
});

// Schema cho Quant Signal V3
export const quantSignalSchema = new Schema(
  {
    signalDetected: { type: Boolean, required: true },
    tokenAddress: { type: String, required: true },
    sources: { type: [sourceSchema], required: true },
    
    // Điểm số V3
    quantScore: { type: Number, required: true }, // Điểm tổng hợp cuối cùng
    volatilityFlag: { type: Number, required: true }, // Cờ chỉ thị độ biến động
    sentimentType: { type: String, required: true }, 
    
    suggestionType: {
      type: String,
      enum: suggestionEnum,
      required: true,
    },
    confidence: { type: Number, min: 0, max: 1, default: null },
    rationaleSummary: { type: String, required: true },
    reasoning: { type: String, default: "" }, // Giữ lại để tương thích ngược nếu cần
    
    relatedTweetIds: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Interface TypeScript cho document
export interface LlmSignalDocument extends Document {
  signalDetected: boolean;
  tokenAddress: string;
  sources: { url: string; label: string }[];
  quantScore: number;
  volatilityFlag: number;
  sentimentType: string;
  suggestionType: typeof suggestionEnum[number];
  confidence: number | null;
  rationaleSummary: string;
  reasoning: string;
  relatedTweetIds: string[];
  metadata?: any;
}

// Model
export const LlmSignalModel = mongoose.model<LlmSignalDocument>(
  "LlmSignal",
  quantSignalSchema
);