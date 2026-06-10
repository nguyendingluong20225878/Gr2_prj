// shared/src/db/schema/signal.ts
import mongoose, { Schema, model } from "mongoose";

const SENTIMENT_TYPES = ["positive", "negative", "neutral", "mixed"]; 
const SUGGESTION_TYPES = ["buy", "sell", "hold", "stake", "close_position"];
const STATUS_TYPES = ["RAW", "PROCESSING", "PROCESSED", "FAILED"]; 

const signalSchema = new Schema({
    tokenSymbol: { type: String, required: true, index: true }, 
    tokenAddress: { type: String, required: true, index: true },
    signalKey: { type: String, required: false },
    detectedAt: { type: Date, default: Date.now, required: true },
    batchId: { type: String, required: false, index: true },
    batchStartedAt: { type: Date, required: false, index: true },
    sources: {
        type: [
            {
                label: { type: String, required: true },
                url: { type: String, required: true },
                sourceKey: { type: String, required: false },
                weight: { type: Number, required: false },
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
    directionScore: { type: Number, required: true, default: 0 }, 
    quantScore: { type: Number, required: true }, 
    // Backward-compatible alias used by older UI. New code should prefer uncertaintyEntropy.
    volatilityFlag: { type: Number, required: false, default: null },
    uncertaintyEntropy: { type: Number, required: false, default: null },
    realizedVolatility: { type: Number, required: false, default: null },
    confidence: { type: Number, required: true },
    rationaleSummary: { type: String, required: false, default: "Đang chờ AI phân tích..." },
    expiresAt: { type: Date, required: false, index: true }, 
    status: { type: String, enum: STATUS_TYPES, default: "RAW", required: true }, 
    layer3LockedAt: { type: Date, required: false, default: null, index: true },
    layer3LockedBy: { type: String, required: false, default: null },
    signalMode: {
        type: String,
        enum: ["COLD_START", "NORMALIZED_ALPHA"],
        required: false,
        default: null,
        index: true,
    },
    metadata: { type: Schema.Types.Mixed, required: false, default: null },
}, {
    collection: "signals",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    strict: false,
});

signalSchema.index({ tokenSymbol: 1, createdAt: -1 });
signalSchema.index({ detectedAt: -1, _id: -1 });
signalSchema.index({ suggestionType: 1, detectedAt: -1, _id: -1 });
signalSchema.index(
    { signalKey: 1 },
    {
        unique: true,
        partialFilterExpression: { signalKey: { $exists: true, $type: "string" } },
    }
);

export const signalsTable = mongoose.models.Signal ?? model("Signal", signalSchema);
