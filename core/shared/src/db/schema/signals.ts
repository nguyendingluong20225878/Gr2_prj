import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  model,
  Model,
} from "mongoose";

export type SignalSource = { label: string; url: string };

const SENTIMENT_TYPES = ["positive", "negative", "neutral"] as const;
const SUGGESTION_TYPES = ["buy", "sell", "hold", "stake", "close_position"] as const;
const STATUS_TYPES = ["RAW", "PROCESSED", "FAILED"] as const; // <-- Thêm danh sách trạng thái

const signalSchema = new Schema(
  {
    tokenSymbol: { type: String, required: true, index: true }, // <-- Thêm Symbol
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
    sentimentType: {
      type: String,
      enum: SENTIMENT_TYPES,
      required: true,
    },
    suggestionType: {
      type: String,
      enum: SUGGESTION_TYPES,
      required: true,
    },
    quantScore: { type: Number, required: true }, // <-- Thêm điểm Toán học (Z-Score)
    confidence: { type: Number, required: true },
    rationaleSummary: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    status: { type: String, enum: STATUS_TYPES, default: "RAW", required: true }, // <-- Thêm Status
    // Optional: store quantitative features for backtesting/audit
    metadata: { type: Schema.Types.Mixed, required: false, default: null },
  },
  {
    collection: "signals",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

export type SignalSchema = InferSchemaType<typeof signalSchema>;
export type SignalDocument = HydratedDocument<SignalSchema>;
export type SignalSelect = SignalDocument;
export type SignalInsert = SignalSchema;

export const signalsTable: Model<SignalSchema> =
  (mongoose.models.Signal as Model<SignalSchema>) ??
  model<SignalSchema>("Signal", signalSchema);