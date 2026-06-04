import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  model,
  Model,
} from "mongoose";

const tokenAliasSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["mint", "address", "coingecko", "priceKey", "symbol", "native"],
    },
    value: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const tokenSchema = new Schema(
  {
    address: { type: String },

    canonicalKey: {
      type: String,
    },

    chain: {
      type: String,
      index: true,
    },

    primaryAddress: { type: String },

    aliases: {
      type: [tokenAliasSchema],
      default: [],
    },

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

tokenSchema.index({ "aliases.value": 1 });
tokenSchema.index({ chain: 1, symbol: 1 });
tokenSchema.index(
  { canonicalKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      canonicalKey: { $exists: true, $ne: null },
    },
  }
);

export type TokenSchema = InferSchemaType<typeof tokenSchema>;
export type TokenAlias = InferSchemaType<typeof tokenAliasSchema>;
export type TokenDocument = HydratedDocument<TokenSchema>;

export const tokensTable: Model<TokenSchema> =
  (mongoose.models.Token as Model<TokenSchema>) ??
  model<TokenSchema>("Token", tokenSchema);
