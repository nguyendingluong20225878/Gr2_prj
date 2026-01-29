import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface cho mảng balances
interface IUserBalance {
  tokenAddress: string;
  balance: string;
  updatedAt: Date;
}

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
  balances: IUserBalance[]; // Khai báo cho TypeScript
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
    // Cấu trúc lưu trữ mảng balances trong MongoDB
    balances: {
      type: [{
        tokenAddress: String,
        balance: String,
        updatedAt: { type: Date, default: Date.now }
      }],
      default: []
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

const UserModel: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default UserModel;