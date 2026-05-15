// shared/src/db/schema/signal.ts
import mongoose, { Schema, model } from "mongoose";

const SENTIMENT_TYPES = ["positive", "negative", "neutral", "mixed"]; 
const SUGGESTION_TYPES = ["buy", "sell", "hold", "stake", "close_position"];
const STATUS_TYPES = ["RAW", "PROCESSED", "FAILED"]; 

const signalSchema = new Schema({
    tokenSymbol: { type: String, required: true, index: true }, 
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
    directionScore: { type: Number, required: true, default: 0 }, 
    quantScore: { type: Number, required: true }, 
    confidence: { type: Number, required: true },
    rationaleSummary: { type: String, required: false, default: "Đang chờ AI phân tích..." },
    expiresAt: { type: Date, required: false, index: true }, 
    status: { type: String, enum: STATUS_TYPES, default: "RAW", required: true }, 
    metadata: { type: Schema.Types.Mixed, required: false, default: null },
}, {
    collection: "signals",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
});

signalSchema.index({ tokenSymbol: 1, createdAt: -1 });

export const signalsTable = mongoose.models.Signal ?? model("Signal", signalSchema);