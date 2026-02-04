import mongoose, { Schema, Model, HydratedDocument } from "mongoose";

/* =======================
   Types
======================= */

export interface Proposal {
  triggerEventId?: string;
  userId?: string;
  title: string;
  summary: string;
  reason: string[];
  sources: {
    name?: string;
    url?: string;
  }[];
  type?: "trade" | "stake" | "risk" | "opportunity" | "hold" | "buy" | "sell";
  proposedBy?: string;
  financialImpact?: {
    currentValue?: number;
    projectedValue?: number;
    percentChange?: number;
    timeFrame?: string;
    riskLevel?: string;
    roi?: number;
  };
  confidence?: number;
  expiresAt: Date;
  status: string;
}

export type ProposalDocument = HydratedDocument<Proposal>;

export type ProposalInsert = Omit<
  Proposal,
  "status"
> & {
  status?: string;
};

/* =======================
   Sub Schemas
======================= */

const SourceSchema = new Schema(
  {
    name: String,
    url: String,
  },
  { _id: false }
);

const FinancialImpactSchema = new Schema(
  {
    currentValue: Number,
    projectedValue: Number,
    percentChange: Number,
    timeFrame: String,
    riskLevel: String,
    roi: Number,
  },
  { _id: false }
);

/* =======================
   Main Schema
======================= */

const ProposalSchema = new Schema<Proposal>(
  {
    triggerEventId: String,
    userId: String,
    title: { type: String, required: true },
    summary: { type: String, required: true },
    reason: { type: [String], required: true },
    sources: { type: [SourceSchema], default: [] },
    type: {
      type: String,
      enum: ["trade", "stake", "risk", "opportunity", "hold", "buy", "sell"],
    },
    proposedBy: { type: String, default: "NDL AI" },
    financialImpact: FinancialImpactSchema,
    confidence: Number,
    expiresAt: { type: Date, required: true },
    status: { type: String, default: "pending" },
  },
  {
    timestamps: true,
    collection: "proposals",
  }
);

/* =======================
   Model getter (ESM-safe)
======================= */

export function getProposalModel(): Model<Proposal> {
  return mongoose.models.Proposal
    ?? mongoose.model<Proposal>("Proposal", ProposalSchema);
}
