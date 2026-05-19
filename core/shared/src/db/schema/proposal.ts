// shared/src/db/schema/proposal.ts
import mongoose, { HydratedDocument, Model, Schema, Types, model } from "mongoose";

export type ProposalExecutionStatus = "PENDING" | "EXECUTED" | "IGNORED";
export type ProposalWinLossStatus = "WIN" | "LOSS" | "BREAKEVEN" | "SKIPPED";

export interface ProposalSource {
    label: string;
    url: string;
}

export interface Proposal {
    signalId: Types.ObjectId;
    tokenSymbol: string;
    tokenAddress: string;
    suggestionType: string;
    sentimentType: string;
    quantScore: number;
    confidence: number;
    rationaleSummary: string;
    sources: ProposalSource[];
    executionStatus: ProposalExecutionStatus;
    entryPrice?: number | null;
    exitPrice?: number | null;
    actualPnL?: number | null;
    winLossStatus?: ProposalWinLossStatus | null;
    pnlPercentage?: number | null;
    backtestedAt?: Date | null;
    backtestMeta?: Record<string, unknown>;
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
    signalId: { type: Schema.Types.ObjectId, ref: "Signal", required: true, index: true },
    
    tokenSymbol: { type: String, required: true, index: true }, 
    tokenAddress: { type: String, required: true },
    
    // Các quyết định cốt lõi
    suggestionType: { type: String, required: true },
    sentimentType: { type: String, required: true },
    quantScore: { type: Number, required: true }, 
    confidence: { type: Number, required: true },
    
    // Bài viết phân tích của AI
    rationaleSummary: { type: String, required: true },
    
    // Nguồn dẫn chứng
    sources: {
        type: [
            {
                label: { type: String, required: true },
                url: { type: String, required: true },
            },
        ],
        required: true,
    },
    
    // Trạng thái thực thi giao dịch (Dành cho Bot Trading sau này)
    executionStatus: { type: String, enum: ["PENDING", "EXECUTED", "IGNORED"], default: "PENDING", required: true },

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
}, {
    collection: "proposals", // Tên bảng mới
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
});

export const proposalsTable: Model<Proposal> =
    (mongoose.models.Proposal as Model<Proposal>) ?? model<Proposal>("Proposal", proposalSchema);

export function getProposalModel(): Model<Proposal> {
    return proposalsTable;
}
