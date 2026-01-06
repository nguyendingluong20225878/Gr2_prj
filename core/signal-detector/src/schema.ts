import mongoose, { Schema, Document } from "mongoose";

// Các loại suggestion
export const suggestionEnum = ["buy", "sell", "hold", "close_position", "stake"] as const;

// Schema cho source
export const sourceSchema = new Schema({
  url: { type: String, required: true },
  label: { type: String, required: true },
});

// Schema chính cho LLM Signal
export const llmSignalSchema = new Schema(
  {
    signalDetected: { type: Boolean, required: true },
    tokenAddress: { type: String, required: true },
    sources: { type: [sourceSchema], required: true },
    sentimentScore: { type: Number, required: true, min: -1, max: 1 },
    suggestionType: {
      type: String,
      enum: suggestionEnum,
      required: true,
    },
    strength: { type: Number, min: 0, max: 100, default: null },
    confidence: { type: Number, min: 0, max: 1, default: null },
    reasoning: { type: String, required: true },
    relatedTweetIds: { type: [String], required: true },
    reasonInvalid: { type: String, default: null },
    impactScore: { type: Number, min: 1, max: 10, default: null },
  },
  { timestamps: true } // tạo createdAt và updatedAt
);

// Middleware để kiểm tra `strength`
llmSignalSchema.pre("save", async function (this: LlmSignalDocument) {
  if (this.signalDetected && (this.strength === null || this.strength < 1)) {
    throw new Error("Strength must be between 1-100…");
  }
  if (!this.signalDetected && this.strength !== 0 && this.strength !== null) {
    throw new Error("Strength must be 0 or null…");
  }
});

// Interface TypeScript cho document
export interface LlmSignalDocument extends Document {
  signalDetected: boolean;
  tokenAddress: string;
  sources: { url: string; label: string }[];
  sentimentScore: number;
  suggestionType: typeof suggestionEnum[number];
  strength: number | null;
  confidence: number | null;
  reasoning: string;
  relatedTweetIds: string[];
  reasonInvalid?: string | null;
  impactScore: number | null;
}

// Model
export const LlmSignalModel = mongoose.model<LlmSignalDocument>(
  "LlmSignal",
  llmSignalSchema
);
