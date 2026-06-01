import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Model,
  Schema,
  model,
} from "mongoose";

const backtestCandidateSchema = new Schema(
  {
    runId: {
      type: Schema.Types.ObjectId,
      ref: "BacktestRun",
      required: true,
      index: true,
    },
    candidateIndex: { type: Number, required: true },
    params: { type: Schema.Types.Mixed, required: true },
    trainMetrics: { type: Schema.Types.Mixed, default: {} },
    validationMetrics: { type: Schema.Types.Mixed, default: null },
    objectiveScore: { type: Number, required: true, index: true },
    status: {
      type: String,
      enum: ["TRAINED", "VALIDATED", "CANDIDATE", "REJECTED", "PROMOTED"],
      required: true,
      index: true,
    },
    promoted: { type: Boolean, default: false, index: true },
  },
  {
    collection: "backtest_candidates",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

backtestCandidateSchema.index({ runId: 1, candidateIndex: 1 }, { unique: true });
backtestCandidateSchema.index({ runId: 1, objectiveScore: -1 });

export type BacktestCandidateSchema =
  InferSchemaType<typeof backtestCandidateSchema>;
export type BacktestCandidateDocument =
  HydratedDocument<BacktestCandidateSchema>;

export const backtestCandidatesTable: Model<BacktestCandidateSchema> =
  (mongoose.models.BacktestCandidate as Model<BacktestCandidateSchema>) ??
  model<BacktestCandidateSchema>(
    "BacktestCandidate",
    backtestCandidateSchema
  );
