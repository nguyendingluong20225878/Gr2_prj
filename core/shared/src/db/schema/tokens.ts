import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  model,
  Model,
} from "mongoose";

const tokenSchema = new Schema(
  {
    address: { type: String },

    coingeckoId: { type: String },

    symbol: {
      type: String,
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
    },

    decimals: {
      type: Number,
      required: true,
      default: 18,
    },

    type: {
      type: String,
      required: true,
      enum: ["coin", "spl", "lending", "perp", "staking"],
      index: true,
    },

    iconUrl: {
      type: String,
      required: true,
    },

    priceUsd: Number,
    priceUpdatedAt: Date,
  },
  {
    collection: "tokens",
    versionKey: false,
  }
);

/* =========================
   INDEX CHUẨN
   ========================= */

tokenSchema.index(
  { address: 1 },
  {
    unique: true,
    partialFilterExpression: {
      address: { $exists: true, $ne: null },
    },
  }
);

tokenSchema.index(
  { coingeckoId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      coingeckoId: { $exists: true, $ne: null },
    },
  }
);

export type TokenSchema = InferSchemaType<typeof tokenSchema>;
export type TokenDocument = HydratedDocument<TokenSchema>;

export const tokensTable: Model<TokenSchema> =
  (mongoose.models.Token as Model<TokenSchema>) ??
  model<TokenSchema>("Token", tokenSchema);
