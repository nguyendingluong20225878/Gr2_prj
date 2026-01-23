//portfolio
import mongoose, { Schema, model, models } from 'mongoose';

const TradeSchema = new Schema({
  walletAddress: { type: String, required: true, index: true },
  proposalId: { type: Schema.Types.ObjectId, ref: 'Proposal' },
  tokenSymbol: { type: String, required: true },
  type: { type: String, enum: ['BUY', 'SELL'], required: true },
  
  amount: { type: Number, required: true },
  entryPrice: { type: Number, required: true },
  currentPrice: { type: Number }, // Cập nhật bởi price-fetcher
  
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
  pnl: { type: Number, default: 0 }, // Lãi/Lỗ
  executedAt: { type: Date, default: Date.now },
});

const Trade = models.Trade || model('Trade', TradeSchema);
export default Trade;
