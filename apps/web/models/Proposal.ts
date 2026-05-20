import mongoose, { InferSchemaType, Schema, model, models } from 'mongoose';

const PROPOSAL_SUGGESTION_TYPES = ['buy', 'sell', 'hold', 'stake', 'close_position'] as const;
const PROPOSAL_EXECUTION_STATUSES = ['PENDING', 'EXECUTED', 'IGNORED'] as const;
const LEGACY_ACTIONS = ['BUY', 'SELL', 'HOLD'] as const;

const ProposalSchema = new Schema({
  // Canonical domain shape shared with core/shared.
  signalId: { type: Schema.Types.ObjectId, ref: 'Signal', index: true },
  tokenSymbol: { type: String, required: true, index: true },
  tokenAddress: { type: String },
  suggestionType: { type: String, enum: PROPOSAL_SUGGESTION_TYPES, index: true },
  sentimentType: { type: String },
  quantScore: { type: Number },
  confidence: { type: Number, required: true },
  rationaleSummary: { type: String },
  sources: {
    type: [
      {
        label: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    default: [],
  },
  executionStatus: {
    type: String,
    enum: PROPOSAL_EXECUTION_STATUSES,
    default: 'PENDING',
    index: true,
  },

  // Compatibility fields for old web proposals. New code should write canonical fields above.
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  triggerSignalId: { type: Schema.Types.ObjectId, ref: 'Signal' },
  tokenName: { type: String },
  
  action: { type: String, enum: LEGACY_ACTIONS },
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

  status: { type: String, default: 'pending' }, 
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
});

const Proposal = models.Proposal || model('Proposal', ProposalSchema);
export default Proposal;
export type ProposalSchema = InferSchemaType<typeof ProposalSchema>;
export type Proposal = ProposalSchema & { _id: string };
