// shared/src/db/schema/proposal.ts
import mongoose, { HydratedDocument, Model, Schema, Types, model } from "mongoose";

export type ProposalExecutionStatus = "PENDING" | "EXECUTED" | "IGNORED";
export type ProposalWinLossStatus = "WIN" | "LOSS" | "BREAKEVEN" | "SKIPPED";
export type ProposalLifecycleStatus = "ACTIVE" | "EXPIRED" | "OVERRIDDEN";

export interface ProposalSource {
    label: string;
    url: string;
}

export interface Proposal {
    signalId?: Types.ObjectId;
    tokenSymbol: string;
    tokenAddress: string;
    suggestionType: string;
    sentimentType: string;
    quantScore: number;
    confidence: number;
    batchId?: string | null;
    batchStartedAt?: Date | null;
    detectedAt?: Date | null;
    lifecycleStatus?: ProposalLifecycleStatus;
    overriddenAt?: Date | null;
    overriddenByProposalId?: Types.ObjectId | null;
    expiredAt?: Date | null;
    volatilityFlag?: number | null;
    uncertaintyEntropy?: number | null;
    realizedVolatility?: number | null;
    signalMode?: "COLD_START" | "NORMALIZED_ALPHA" | null;
    scoreComponents?: Record<string, unknown>;
    rationaleSummary: string;
    sources: ProposalSource[];
    executionStatus: ProposalExecutionStatus;
    expiresAt?: Date | null;
    entryPrice?: number | null;
    exitPrice?: number | null;
    actualPnL?: number | null;
    winLossStatus?: ProposalWinLossStatus | null;
    pnlPercentage?: number | null;
    backtestedAt?: Date | null;
    backtestMeta?: Record<string, unknown>;
    signalUpdatedAt?: Date | null;
    status?: string;
    action?: string;
    title?: string;
    summary?: string;
    reason?: string[];
    type?: string;
    proposedBy?: string;
    userId?: Types.ObjectId | string;
    triggerSignalId?: Types.ObjectId;
    triggerEventId?: string;
    tokenName?: string;
    financialImpact?: {
        currentPrice?: number;
        currentValue?: number;
        projectedPnL?: number;
        projectedValue?: number;
        roi?: number;
        roiPercent?: number;
        percentChange?: number;
        targetPrice?: number;
        timeFrame?: string;
        riskLevel?: string;
    };
    analysis?: {
        reasoning?: string[];
        risks?: string[];
    };
    createdAt?: Date;
    updatedAt?: Date;
}

type LegacyProposalInsertFields = {
    title?: string;
    summary?: string;
    reason?: string[];
    type?: string;
    proposedBy?: string;
    expiresAt?: Date;
    financialImpact?: {
        currentValue?: number;
        projectedValue?: number;
        percentChange?: number;
        roi?: number;
        timeFrame?: string;
        riskLevel?: string;
    };
    status?: string;
    userId?: string | Types.ObjectId;
};

export type ProposalDocument = HydratedDocument<Proposal>;
export type ProposalInsert = Partial<Proposal> & LegacyProposalInsertFields;

const proposalSchema = new Schema<Proposal>({
    // Lưu lại ID của signal gốc để dễ dàng truy xuất (Traceability)
    signalId: { type: Schema.Types.ObjectId, ref: "Signal", required: false, index: true },
    
    tokenSymbol: { type: String, required: true, index: true }, 
    tokenAddress: { type: String, required: true },
    
    // Các quyết định cốt lõi
    suggestionType: { type: String, required: true },
    sentimentType: { type: String, required: true },
    quantScore: { type: Number, required: true }, 
    confidence: { type: Number, required: true },
    batchId: { type: String, default: null, index: true },
    batchStartedAt: { type: Date, default: null, index: true },
    detectedAt: { type: Date, default: null, index: true },
    lifecycleStatus: {
        type: String,
        enum: ["ACTIVE", "EXPIRED", "OVERRIDDEN"],
        default: "ACTIVE",
        index: true,
    },
    overriddenAt: { type: Date, default: null },
    overriddenByProposalId: { type: Schema.Types.ObjectId, ref: "Proposal", default: null },
    expiredAt: { type: Date, default: null },
    volatilityFlag: { type: Number, default: null },
    uncertaintyEntropy: { type: Number, default: null },
    realizedVolatility: { type: Number, default: null },
    signalMode: {
        type: String,
        enum: ["COLD_START", "NORMALIZED_ALPHA"],
        default: null,
        index: true,
    },
    scoreComponents: { type: Schema.Types.Mixed, default: {} },
    
    // Bài viết phân tích của AI
    rationaleSummary: { type: String, required: true },
    
    // Nguồn dẫn chứng
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
    
    // Trạng thái thực thi giao dịch (Dành cho Bot Trading sau này)
    executionStatus: { type: String, enum: ["PENDING", "EXECUTED", "IGNORED"], default: "PENDING", required: true },
    expiresAt: { type: Date, default: null, index: true },

    // Backtest result fields
    entryPrice: { type: Number, default: null },
    exitPrice: { type: Number, default: null },
    actualPnL: { type: Number, default: null },
    winLossStatus: {
        type: String,
        enum: ["WIN", "LOSS", "BREAKEVEN", "SKIPPED"],
        default: null,
        index: true,
    },
    pnlPercentage: { type: Number, default: null },
    backtestedAt: { type: Date, default: null, index: true },
    backtestMeta: { type: Schema.Types.Mixed, default: {} },
    signalUpdatedAt: { type: Date, default: null, index: true },

    // Compatibility fields used by the Next.js app and older proposal documents.
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    triggerSignalId: { type: Schema.Types.ObjectId, ref: "Signal" },
    triggerEventId: { type: String },
    tokenName: { type: String },
    action: { type: String, enum: ["BUY", "SELL", "HOLD"] },
    title: { type: String },
    summary: { type: String },
    reason: { type: [String], default: [] },
    type: { type: String },
    proposedBy: { type: String },
    financialImpact: {
        currentPrice: Number,
        currentValue: Number,
        projectedPnL: Number,
        projectedValue: Number,
        roi: Number,
        roiPercent: Number,
        percentChange: Number,
        targetPrice: Number,
        stopLoss: Number,
        riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
        timeFrame: String,
    },
    analysis: {
        reasoning: [String],
        risks: [String],
    },
    status: { type: String, default: "pending", index: true },
}, {
    collection: "proposals", // Tên bảng mới
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    strict: false,
});

proposalSchema.index(
    { signalId: 1, createdAt: -1, _id: -1 },
    { partialFilterExpression: { signalId: { $exists: true } } }
);
proposalSchema.index(
    { tokenSymbol: 1 },
    {
        unique: true,
        partialFilterExpression: { lifecycleStatus: "ACTIVE" },
    }
);

export const proposalsTable: Model<Proposal> =
    (mongoose.models.Proposal as Model<Proposal>) ?? model<Proposal>("Proposal", proposalSchema);

export function getProposalModel(): Model<Proposal> {
    return proposalsTable;
}
