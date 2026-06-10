import mongoose, { Model, Schema } from 'mongoose';

export type WatchlistAddedBy = 'USER' | 'SYSTEM';
export type WatchlistStatus = 'WATCHING' | 'RESOLVED' | 'EXPIRED';

export interface WatchlistRecord {
  proposalId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
  walletAddress?: string | null;
  addedBy: WatchlistAddedBy;
  reason?: string | null;
  status: WatchlistStatus;
  addedAt: Date;
  resolvedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const WatchlistSchema = new Schema<WatchlistRecord>(
  {
    proposalId: { type: Schema.Types.ObjectId, ref: 'Proposal', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    walletAddress: { type: String, default: null, index: true },
    addedBy: { type: String, enum: ['USER', 'SYSTEM'], default: 'USER', required: true },
    reason: { type: String, default: null },
    status: { type: String, enum: ['WATCHING', 'RESOLVED', 'EXPIRED'], default: 'WATCHING', required: true, index: true },
    addedAt: { type: Date, default: Date.now, required: true },
    resolvedAt: { type: Date, default: null },
  },
  {
    collection: 'watchlist_items',
    timestamps: true,
  }
);

WatchlistSchema.index(
  { walletAddress: 1, proposalId: 1 },
  { unique: true, partialFilterExpression: { walletAddress: { $type: 'string' } } }
);

const WatchlistModel: Model<WatchlistRecord> =
  mongoose.models.WatchlistItem || mongoose.model<WatchlistRecord>('WatchlistItem', WatchlistSchema);

export default WatchlistModel;
