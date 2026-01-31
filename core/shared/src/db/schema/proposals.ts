import mongoose, { Schema, Document, Model } from "mongoose";

export interface ProposalDocument extends Document {
  triggerEventId?: string;
  userId?: string;
  title: string;
  summary: string;
  reason: string[];
  sources: { name?: string; url?: string; }[];
  type?: string;
  proposedBy?: string;
  financialImpact?: {
    currentValue?: number;
    projectedValue?: number;
    percentChange?: number;
    timeFrame?: string;
    riskLevel?: string;
    roi?: number; // <--- THÊM MỚI
  };
  confidence?: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  status: string;
}

export type ProposalInsert = Omit<
  ProposalDocument,
  | "_id"
  | "createdAt"
  | "updatedAt"
>;

const SourceSchema = new Schema({ name: { type: String }, url: { type: String } }, { _id: false });

const FinancialImpactSchema = new Schema({
  currentValue: { type: Number },
  projectedValue: { type: Number },
  percentChange: { type: Number },
  timeFrame: { type: String },
  riskLevel: { type: String },
  roi: { type: Number }, // <--- THÊM MỚI: Lưu % lợi nhuận dự kiến
}, { _id: false });

const ProposalSchema = new Schema<ProposalDocument>(
  {
    triggerEventId: { type: String },
    userId: { type: String },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    reason: { type: [String], required: true },
    sources: { type: [SourceSchema], default: [] },
    type: { type: String, enum: ["trade", "stake", "risk", "opportunity", "hold", "buy", "sell"] },
    proposedBy: { type: String, default: "NDL AI" },
    financialImpact: { type: FinancialImpactSchema },
    confidence: { type: Number }, 
    expiresAt: { type: Date, required: true },
    status: { type: String, default: "pending" },
  },
  { timestamps: true }
);

export function getProposalModel(): Model<ProposalDocument> {
  return mongoose.models.Proposal || mongoose.model<ProposalDocument>("Proposal", ProposalSchema);
}