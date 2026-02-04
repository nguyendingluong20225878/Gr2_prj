import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  Model,
} from "mongoose";

const farcasterKeywordSchema = new Schema(
  {
    keyword: { type: String, required: true, unique: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    lastScannedAt: { type: Date },
  },
  {
    collection: "farcaster_keywords",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

export type FarcasterKeywordSchema =
  InferSchemaType<typeof farcasterKeywordSchema>;
export type FarcasterKeywordDocument =
  HydratedDocument<FarcasterKeywordSchema>;

export const farcasterKeywordsTable: Model<FarcasterKeywordSchema> =
  (mongoose.models.FarcasterKeyword as Model<FarcasterKeywordSchema>) ??
  mongoose.model<FarcasterKeywordSchema>(
    "FarcasterKeyword",
    farcasterKeywordSchema,
  );
