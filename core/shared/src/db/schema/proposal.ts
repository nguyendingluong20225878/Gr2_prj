// shared/src/db/schema/proposal.ts
import mongoose, { Schema, model } from "mongoose";

const proposalSchema = new Schema({
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
    executionStatus: { type: String, enum: ["PENDING", "EXECUTED", "IGNORED"], default: "PENDING" },
}, {
    collection: "proposals", // Tên bảng mới
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
});

export const proposalsTable = mongoose.models.Proposal ?? model("Proposal", proposalSchema);
export type Proposal = mongoose.InferSchemaType<typeof proposalSchema>;