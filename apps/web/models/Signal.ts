import mongoose, { Schema, model, models, InferSchemaType } from "mongoose";

const SENTIMENT_TYPES = ["positive", "negative", "neutral"] as const;
const SUGGESTION_TYPES = ["buy", "sell", "hold", "stake", "close_position"] as const;

const signalSchema = new Schema(
  {
    tokenAddress: { type: String, required: true, index: true },
    detectedAt: { type: Date, default: Date.now, required: true },
    sources: {
      type: [
        {
          label: { type: String, required: true },
          url: { type: String, required: true },
        },
      ],
      required: true,
    },
    sentimentType: { type: String, enum: SENTIMENT_TYPES, required: true },
    suggestionType: { type: String, enum: SUGGESTION_TYPES, required: true },
    confidence: { type: Number, required: true },
    rationaleSummary: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  {
    collection: "signals",
    timestamps: true,
  }
);

export type SignalSchema = InferSchemaType<typeof signalSchema>;

export const SignalModel = models.Signal || model("Signal", signalSchema);