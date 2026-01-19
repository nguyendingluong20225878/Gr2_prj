// apps/web/models/User.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  walletAddress: string;
  email?: string;
  name?: string;
  riskTolerance?: string;
  tradeStyle?: string;
  totalAssetUsd?: number;
  cryptoInvestmentUsd?: number;
  image?: string;
  notificationEnabled: boolean;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    walletAddress: { type: String, required: true, unique: true, index: true },
    email: { type: String },
    name: { type: String },
    riskTolerance: { type: String },
    tradeStyle: { type: String },
    totalAssetUsd: { type: Number, default: 0 },
    cryptoInvestmentUsd: { type: Number, default: 0 },
    image: { type: String },
    notificationEnabled: { type: Boolean, default: true },
    role: { type: String, default: 'user' },
  },
  {
    timestamps: true, // Tự động tạo createdAt, updatedAt
  }
);

// Ngăn lỗi OverwriteModelError khi compile lại trong Next.js
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;