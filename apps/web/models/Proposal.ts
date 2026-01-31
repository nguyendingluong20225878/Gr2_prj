import mongoose, { Schema, model, models } from 'mongoose';

const ProposalSchema = new Schema({
  // 1. LIÊN KẾT DỮ LIỆU
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  triggerSignalId: { type: Schema.Types.ObjectId, ref: 'Signal', required: true },

  // 2. THÔNG TIN TOKEN
  tokenSymbol: { type: String, required: true },
  tokenName: { type: String, required: true },
  
  // 3. QUYẾT ĐỊNH CỦA AI
  action: { type: String, enum: ['BUY', 'SELL', 'HOLD'], required: true },
  title: { type: String },
  summary: { type: String },
  
  // 4. DỮ LIỆU TÀI CHÍNH
  financialImpact: {
    currentPrice: Number,
    targetPrice: Number,
    stopLoss: Number,
    projectedPnL: Number, 
    roiPercent: Number, // Legacy
    roi: Number,        // === THÊM MỚI ===
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
    timeFrame: String,
  },
  
  // 5. PHÂN TÍCH
  analysis: {
    reasoning: [String],
    risks: [String],
  },

  confidence: { type: Number, required: true }, 

  // === FIX DEFAULT STATUS: Đổi từ 'ACTIVE' sang 'pending' ===
  status: { type: String, default: 'pending' }, 
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

const Proposal = models.Proposal || model('Proposal', ProposalSchema);
export default Proposal;