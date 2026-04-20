import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  model,
  Model,
} from "mongoose";

const sourceWeightSchema = new Schema(
  {
    // e.g. "coindesk.com", "cointelegraph.com"
    siteHost: { type: String, required: true, unique: true, index: true },
    horizonHours: { type: Number, required: true, default: 24 },
    windowDays: { type: Number, required: true, default: 60 },
    sampleCount: { type: Number, required: true, default: 0 },
    ic: { type: Number, required: true, default: 0 }, // Information Coefficient
    siteWeight: { type: Number, required: true, default: 1 }, // derived from ic
    updatedAt: { type: Date, required: true, default: Date.now },
  },
  {
    collection: "source_weights",
    timestamps: false,
  }
);

export type SourceWeightSchema = InferSchemaType<typeof sourceWeightSchema>;
export type SourceWeightDocument = HydratedDocument<SourceWeightSchema>;
export type SourceWeightSelect = SourceWeightDocument;
export type SourceWeightInsert = SourceWeightSchema;

export const sourceWeightsTable: Model<SourceWeightSchema> =
  (mongoose.models.SourceWeight as Model<SourceWeightSchema>) ??
  model<SourceWeightSchema>("SourceWeight", sourceWeightSchema);

