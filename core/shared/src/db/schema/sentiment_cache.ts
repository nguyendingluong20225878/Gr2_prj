import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Model,
  Schema,
  model,
} from "mongoose";

const sentimentCacheSchema = new Schema(
  {
    textHash: { type: String, required: true, index: true },
    modelName: { type: String, required: true, index: true },
    pPos: { type: Number, required: true },
    pNeg: { type: Number, required: true },
    pNeu: { type: Number, required: true },
    baseScore: { type: Number, required: true },
    source: {
      type: String,
      enum: ["HF_FINBERT", "FALLBACK"],
      default: "HF_FINBERT",
      index: true,
    },
    lastUsedAt: { type: Date, default: Date.now, index: true },
  },
  {
    collection: "sentiment_cache",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

sentimentCacheSchema.index({ textHash: 1, modelName: 1 }, { unique: true });

export type SentimentCacheSchema =
  InferSchemaType<typeof sentimentCacheSchema>;
export type SentimentCacheDocument =
  HydratedDocument<SentimentCacheSchema>;

export const sentimentCacheTable: Model<SentimentCacheSchema> =
  (mongoose.models.SentimentCache as Model<SentimentCacheSchema>) ??
  model<SentimentCacheSchema>("SentimentCache", sentimentCacheSchema);
