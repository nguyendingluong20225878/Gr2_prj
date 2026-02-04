import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  model,
  Model,
} from "mongoose";

const tokenPriceHistorySchema = new Schema(
  {
    tokenAddress: { type: String, required: true, index: true },
    token: { type: Schema.Types.ObjectId, ref: "Token" },
    priceUsd: { type: String, required: true },
    timestamp: { type: Date, required: true, index: true },
    source: { type: String, required: true },
  },
  {
    collection: "token_price_history",
    timestamps: false,
  },
);

tokenPriceHistorySchema.index({ tokenAddress: 1, timestamp: 1 });

export type TokenPriceHistorySchema =
  InferSchemaType<typeof tokenPriceHistorySchema>;
export type TokenPriceHistoryDocument =
  HydratedDocument<TokenPriceHistorySchema>;
export type TokenPriceHistory = TokenPriceHistoryDocument;
export type InsertTokenPriceHistory = TokenPriceHistorySchema;

export const tokenPriceHistory: Model<TokenPriceHistorySchema> =
  (mongoose.models.TokenPriceHistory as Model<TokenPriceHistorySchema>) ??
  model<TokenPriceHistorySchema>(
    "TokenPriceHistory",
    tokenPriceHistorySchema
  );
