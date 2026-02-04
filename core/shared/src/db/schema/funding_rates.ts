import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  Model,
} from "mongoose";

const fundingRateSchema = new Schema(
  {
    tokenAddress: { type: String, required: true, index: true },
    token: { type: Schema.Types.ObjectId, ref: "Token" },
    rate: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    collection: "funding_rates",
    timestamps: false,
  },
);

export type FundingRateSchema =
  InferSchemaType<typeof fundingRateSchema>;
export type FundingRateDocument =
  HydratedDocument<FundingRateSchema>;
export type FundingRateSelect = FundingRateDocument;
export type FundingRateInsert = FundingRateSchema;

export const fundingRatesTable: Model<FundingRateSchema> =
  (mongoose.models.FundingRate as Model<FundingRateSchema>) ??
  mongoose.model<FundingRateSchema>(
    "FundingRate",
    fundingRateSchema,
  );
