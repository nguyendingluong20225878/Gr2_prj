// core/proposal-generator/scripts/generateProposal.ts
import { config } from "dotenv";
import mongoose from "mongoose";
import path from "path";

// 1. Load biến môi trường từ file .env của proposal-generator
config({ path: path.resolve(__dirname, "../.env") });

// Đảm bảo process.env có MONGODB_URI để các module shared có thể đọc được
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = "mongodb://localhost:27017/gr2_prj";
}

const MONGODB_URI = process.env.MONGODB_URI;

// 2. ĐỊNH NGHĨA SCHEMAS (Đã sửa để khớp với core/shared/src/db/schema/proposals.ts)
const UserSchema = new mongoose.Schema({
  walletAddress: String,
  riskTolerance: String,
  totalAssetUsd: Number,
  balances: Array 
});

const SignalSchema = new mongoose.Schema({
  tokenAddress: String,
  suggestionType: String,
  expiresAt: Date,
  createdAt: Date
});

const ProposalSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Map theo shared schema (String)
  triggerEventId: { type: String, required: true }, // Sửa từ triggerSignalId -> triggerEventId
  
  tokenSymbol: String,
  tokenName: String,
  type: { type: String, enum: ["trade", "stake", "risk", "opportunity", "hold", "buy", "sell"] },
  title: String,
  summary: String,
  
  financialImpact: {
    currentValue: Number,
    projectedValue: Number,
    percentChange: Number,
    timeFrame: String,
    riskLevel: String,
  },
  
  reason: [String], 
  sources: [{ name: String, url: String }],
  confidence: Number,
  proposedBy: { type: String, default: "NDL AI" },
  status: { type: String, default: 'pending' }, // Dashboard thường dùng 'pending' hoặc 'ACTIVE'
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);
const SignalModel = mongoose.models.Signal || mongoose.model("Signal", SignalSchema);
const ProposalModel = mongoose.models.Proposal || mongoose.model("Proposal", ProposalSchema);

const main = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ DB Connected.");

    const signal = await SignalModel.findOne().sort({ createdAt: -1 });
    if (!signal) {
      console.error("❌ No signals found.");
      process.exit(1);
    }

    const users = await UserModel.find({});
    console.log(`👥 Found ${users.length} Users. Starting generation...`);

    const { initProposalGeneratorGraph } = await import("../src/index");

    for (const user of users) {
      try {
        const { graph, config: graphConfig } = await initProposalGeneratorGraph(signal._id.toString(), user._id.toString());
        const result = await graph.invoke({}, graphConfig);
        
        const aiProposal = result.proposal;
        if (aiProposal) {
          // Xóa proposal cũ để tránh trùng lặp
          await ProposalModel.deleteMany({ userId: user._id.toString(), triggerEventId: signal._id.toString() });

          // Lưu theo đúng định dạng core (Shared Schema)
          const finalProposalData = {
            ...aiProposal,
            userId: user._id.toString(),
            triggerEventId: signal._id.toString(),
            status: aiProposal.status || 'pending',
            expiresAt: signal.expiresAt || new Date(Date.now() + 48 * 60 * 60 * 1000)
          };

          await ProposalModel.create(finalProposalData);
          console.log(`✅ [SUCCESS] Proposal saved for user ${user._id}: ${aiProposal.title}`);
        }
      } catch (err: any) {
        console.error(`❌ [ERROR] User ${user._id}:`, err.message);
      }
    }
  } catch (error) {
    console.error("❌ Fatal Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

main();