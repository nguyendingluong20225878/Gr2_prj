import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const tokenPriceSchema = new Schema(
  {
    tokenAddress: { type: String, required: true, unique: true },
    token: { type: Schema.Types.ObjectId, ref: "Token" },
    priceUsd: { type: String, required: true },
    lastUpdated: { type: Date, default: Date.now, index: true },
    source: { type: String, required: true },
  },
  {
    collection: "token_prices",
    timestamps: false,
  },
);

export type TokenPriceSchema = InferSchemaType<typeof tokenPriceSchema>;
export type TokenPriceDocument = HydratedDocument<TokenPriceSchema>;
export type TokenPriceSelect = TokenPriceDocument;
export type TokenPriceInsert = TokenPriceSchema;

// === FIX: Export đúng tên TokenPriceModel mà service đang gọi ===
export const TokenPriceModel = models.TokenPrice || model<TokenPriceSchema>("TokenPrice", tokenPriceSchema);

// Giữ lại alias cũ (nếu code khác còn dùng) để tránh lỗi breaking change
export const tokenPricesTable = TokenPriceModel;