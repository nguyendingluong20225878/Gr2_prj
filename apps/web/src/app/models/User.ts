import { Schema, model, models } from "mongoose";

const userSchema = new Schema({
  name: { type: String },
  email: { type: String, required: true, index: true, unique: true }, // BẮT BUỘC
  emailVerified: { type: Date, default: null },
  age: { type: Number },
  image: { type: String },
  tradeStyle: { type: String },
  totalAssetUsd: { type: Number },
  cryptoInvestmentUsd: { type: Number },
  walletAddress: { type: String, required: true, index: true },
  riskTolerance: { type: String, default: "medium" },
  notificationEnabled: { type: Boolean, default: false },
  balances: { type: Array, default: [] },
}, { timestamps: true });

export const User = models.User || model("User", userSchema);

// TypeScript interface for type safety
export interface IUser {
  _id: string;
  name?: string;
  email: string;
  emailVerified?: Date | null;
  age?: number;
  image?: string;
  tradeStyle?: string;
  totalAssetUsd?: number;
  cryptoInvestmentUsd?: number;
  walletAddress: string;
  riskTolerance: string;
  notificationEnabled: boolean;
  balances: any[];
  createdAt: Date;
  updatedAt: Date;
}
