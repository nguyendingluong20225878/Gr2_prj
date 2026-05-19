import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Model,
  Schema,
  model,
} from "mongoose";

const backtestResultSchema = new Schema(
  {
    proposalId: {
      type: Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
    },
    signalId: { type: Schema.Types.ObjectId, ref: "Signal", index: true },
    tokenSymbol: { type: String, required: true, index: true },
    tokenAddress: { type: String, required: true, index: true },
    suggestionType: { type: String, required: true, index: true },
    detectedAt: { type: Date, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    entryPrice: { type: Number, required: true },
    exitPrice: { type: Number, required: true },
    grossPnlPercentage: { type: Number, required: true },
    pnlPercentage: { type: Number, required: true },
    actualPnL: { type: Number, required: true },
    winLossStatus: {
      type: String,
      enum: ["WIN", "LOSS", "BREAKEVEN"],
      required: true,
      index: true,
    },
    feeRate: { type: Number, required: true },
    slippageRate: { type: Number, required: true },
    notionalUsd: { type: Number, required: true },
    equityAfterTrade: { type: Number, required: true },
    dataQuality: {
      type: String,
      enum: ["OK", "SPARSE", "FALLBACK_CURRENT_PRICE"],
      required: true,
      index: true,
    },
  },
  {
    collection: "backtest_results",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

backtestResultSchema.index({ proposalId: 1 }, { unique: true });
backtestResultSchema.index({ expiresAt: 1, tokenSymbol: 1 });

export type BacktestResultSchema =
  InferSchemaType<typeof backtestResultSchema>;
export type BacktestResultDocument =
  HydratedDocument<BacktestResultSchema>;

export const backtestResultsTable: Model<BacktestResultSchema> =
  (mongoose.models.BacktestResult as Model<BacktestResultSchema>) ??
  model<BacktestResultSchema>("BacktestResult", backtestResultSchema);
