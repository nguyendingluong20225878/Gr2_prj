import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  walletAddress: string;
  email?: string;
  name?: string;
  age?: number;
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

const UserSchema = new Schema<IUser>(
  {
    walletAddress: { type: String, required: true, unique: true, index: true },
    email: { type: String },
    name: { type: String },
    age: { type: Number, default: 0 },
    riskTolerance: { type: String, default: 'medium' },
    tradeStyle: { type: String, default: 'swing' },
    totalAssetUsd: { type: Number, default: 0 },
    cryptoInvestmentUsd: { type: Number, default: 0 },
    image: { type: String },
    notificationEnabled: { type: Boolean, default: true },
    role: { type: String, default: 'user' },
  },
  {
    timestamps: true,
    collection: 'users' // Bắt buộc định nghĩa tên collection rõ ràng
  }
);

// Logic ngăn chặn lỗi "OverwriteModelError" trong Next.js
const UserModel: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default UserModel;