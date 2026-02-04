import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  model,
  Model,
} from "mongoose";

const tokenPriceSchema = new Schema(
  {
    // Ví dụ:
    // coingecko:bitcoin
    // spl:So11111111111111111111111111111111111111112
    tokenKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    token: { type: Schema.Types.ObjectId, ref: "Token" },

    priceUsd: {
      type: Number,
      required: true,
    },

    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true,
    },

    source: {
      type: String,
      required: true,
    },
  },
  {
    collection: "token_prices",
    versionKey: false,
  }
);

export type TokenPriceSchema = InferSchemaType<typeof tokenPriceSchema>;
export type TokenPriceDocument = HydratedDocument<TokenPriceSchema>;

export const tokenPricesTable: Model<TokenPriceSchema> =
  (mongoose.models.TokenPrice as Model<TokenPriceSchema>) ??
  model<TokenPriceSchema>("TokenPrice", tokenPriceSchema);
