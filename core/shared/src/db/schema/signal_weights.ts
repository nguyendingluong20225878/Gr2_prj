import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  model,
  Model,
} from "mongoose";

const signalWeightsSchema = new Schema(
  {
    horizonHours: { type: Number, required: true, default: 24 },
    windowDays: { type: Number, required: true, default: 60 },
    // Rolling IC
    icTwitter: { type: Number, required: true, default: 0 },
    icNews: { type: Number, required: true, default: 0 },
    // Rolling variance (scores already normalized)
    varTwitter: { type: Number, required: true, default: 1 },
    varNews: { type: Number, required: true, default: 1 },
    // Final blended weights (sum ~ 1)
    wTwitter: { type: Number, required: true, default: 0.5 },
    wNews: { type: Number, required: true, default: 0.5 },
    updatedAt: { type: Date, required: true, default: Date.now, index: true },
  },
  {
    collection: "signal_weights",
    timestamps: false,
  }
);

signalWeightsSchema.index({ updatedAt: -1 });

export type SignalWeightsSchema = InferSchemaType<typeof signalWeightsSchema>;
export type SignalWeightsDocument = HydratedDocument<SignalWeightsSchema>;
export type SignalWeightsSelect = SignalWeightsDocument;
export type SignalWeightsInsert = SignalWeightsSchema;

export const signalWeightsTable: Model<SignalWeightsSchema> =
  (mongoose.models.SignalWeights as Model<SignalWeightsSchema>) ??
  model<SignalWeightsSchema>("SignalWeights", signalWeightsSchema);

