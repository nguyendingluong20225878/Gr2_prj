import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  Model,
} from "mongoose";

const portfolioSnapshotSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    timestamp: { type: Date, required: true, index: true },
    totalValueUsd: { type: String, required: true },
    pnlFromPrevious: { type: String },
    pnlFromStart: { type: String },
    snapshotDetails: { type: Schema.Types.Mixed },
  },
  {
    collection: "portfolio_snapshots",
    timestamps: { createdAt: "createdAt", updatedAt: false },
  },
);

portfolioSnapshotSchema.index({ userId: 1, timestamp: 1 });

export type PortfolioSnapshotSchema = InferSchemaType<
  typeof portfolioSnapshotSchema
>;
export type PortfolioSnapshotDocument =
  HydratedDocument<PortfolioSnapshotSchema>;
export type PortfolioSnapshot = PortfolioSnapshotDocument;
export type NewPortfolioSnapshot = PortfolioSnapshotSchema;

export const portfolioSnapshots: Model<PortfolioSnapshotSchema> =
  (mongoose.models.PortfolioSnapshot as Model<PortfolioSnapshotSchema>) ??
  mongoose.model<PortfolioSnapshotSchema>(
    "PortfolioSnapshot",
    portfolioSnapshotSchema,
  );
