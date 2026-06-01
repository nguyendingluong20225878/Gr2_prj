import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Model,
  Schema,
  model,
} from "mongoose";

const backtestRunSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["HYPERPARAM_OPTIMIZATION", "PROPOSAL_REPLAY", "WALK_FORWARD"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["RUNNING", "COMPLETED", "FAILED"],
      required: true,
      index: true,
    },
    optimizer: { type: String, default: "grid_search" },
    trainWindow: {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },
    validationWindow: {
      from: { type: Date, default: null },
      to: { type: Date, default: null },
    },
    options: { type: Schema.Types.Mixed, default: {} },
    metrics: { type: Schema.Types.Mixed, default: {} },
    errorMessage: { type: String, default: null },
    startedAt: { type: Date, required: true, index: true },
    endedAt: { type: Date, default: null },
  },
  {
    collection: "backtest_runs",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

backtestRunSchema.index({ type: 1, startedAt: -1 });

export type BacktestRunSchema = InferSchemaType<typeof backtestRunSchema>;
export type BacktestRunDocument = HydratedDocument<BacktestRunSchema>;

export const backtestRunsTable: Model<BacktestRunSchema> =
  (mongoose.models.BacktestRun as Model<BacktestRunSchema>) ??
  model<BacktestRunSchema>("BacktestRun", backtestRunSchema);
