import mongoose, { Schema, model, models } from 'mongoose';

const ProposalSchema = new Schema({
  // 1. LIÊN KẾT DỮ LIỆU (QUAN TRỌNG NHẤT)
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  triggerSignalId: { type: Schema.Types.ObjectId, ref: 'Signal', required: true },

  // 2. THÔNG TIN TOKEN (Cache lại để hiển thị nhanh)
  tokenSymbol: { type: String, required: true },
  tokenName: { type: String, required: true },
  
  // 3. QUYẾT ĐỊNH CỦA AI (Dành cho User này)
  action: { type: String, enum: ['BUY', 'SELL', 'HOLD'], required: true },
  title: { type: String }, // Tiêu đề ngắn gọn: "Mua ngay SOL vì..."
  summary: { type: String }, // Tóm tắt lý do
  
  // 4. DỮ LIỆU TÀI CHÍNH (Đã cá nhân hóa theo vốn của User)
  financialImpact: {
    currentPrice: Number,
    targetPrice: Number,
    stopLoss: Number,
    projectedPnL: Number, // Lãi dự kiến ($)
    roiPercent: Number,   // Lãi dự kiến (%)
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
    timeFrame: String,    // '24h', '1 week'
  },
  
  // 5. PHÂN TÍCH
  analysis: {
    reasoning: [String], // Các lý do chính
    risks: [String],     // Rủi ro cần lưu ý
  },

  // Confidence của AI khi đưa ra lời khuyên này
  confidence: { type: Number, required: true }, 

  status: { type: String, default: 'ACTIVE' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

const Proposal = models.Proposal || model('Proposal', ProposalSchema);
export default Proposal;