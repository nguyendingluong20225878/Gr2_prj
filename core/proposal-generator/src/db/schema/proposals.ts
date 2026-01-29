import mongoose, { Schema, Document } from "mongoose";

/**
 * Proposal Document Interface
 */
export interface ProposalDocument extends Document {
  triggerEventId?: string;
  userId?: string;
  title: string;
  summary: string;
  reason: string[];
  sources: {
    name?: string;
    url?: string;
  }[];
  type?: string;
  proposedBy?: string;
  financialImpact?: {
    currentValue?: number;
    projectedValue?: number;
    percentChange?: number;
    timeFrame?: string;
    riskLevel?: string;
  };
  confidence?: number; // Đã thêm
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  status: string;
}

/**
 * Sub-schemas
 */
const SourceSchema = new Schema(
  {
    name: { type: String },
    url: { type: String },
  },
  { _id: false },
);

const FinancialImpactSchema = new Schema(
  {
    currentValue: { type: Number },
    projectedValue: { type: Number },
    percentChange: { type: Number },
    timeFrame: { type: String },
    riskLevel: { type: String },
  },
  { _id: false },
);

/**
 * Main Proposal Schema
 */
const ProposalSchema = new Schema<ProposalDocument>(
  {
    triggerEventId: { type: String },
    userId: { type: String },

    title: {
      type: String,
      required: true,
    },

    summary: {
      type: String,
      required: true,
    },

    reason: {
      type: [String],
      required: true,
    },

    sources: {
      type: [SourceSchema],
      default: [],
    },

    type: {
      type: String,
      enum: ["trade", "stake", "risk", "opportunity", "hold", "buy", "sell"],
    },

    proposedBy: {
      type: String,
      default: "GR2 Project",
    },

    financialImpact: {
      type: FinancialImpactSchema,
    },

    // QUAN TRỌNG: Thêm trường confidence vào đây để Mongoose cho phép lưu
    confidence: {
      type: Number,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      default: "pending",
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Export model
 */
export const ProposalModel =
  mongoose.models.Proposal ||
  mongoose.model<ProposalDocument>("Proposal", ProposalSchema);