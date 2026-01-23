// core/proposal-generator/scripts/generateProposal.ts
import { config } from "dotenv";
import mongoose from "mongoose";
import path from "path";

// 1. Load biến môi trường
// Giả định file .env nằm ngay trong thư mục core/proposal-generator
config({ path: path.resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/gr2_prj";

// 2. ĐỊNH NGHĨA SCHEMAS (Local Definition)
// Định nghĩa lại ở đây để script chạy độc lập mà không phụ thuộc vào đường dẫn import phức tạp của monorepo

// Schema User (chỉ cần lấy các trường cần thiết)
const UserSchema = new mongoose.Schema({
  walletAddress: String,
  riskTolerance: String,
  totalAssetUsd: Number,
  balances: Array 
});

// Schema Signal
const SignalSchema = new mongoose.Schema({
  tokenAddress: String,
  suggestionType: String,
  expiresAt: Date,
  createdAt: Date
});

// Schema Proposal (Phải KHỚP 100% với apps/web/models/Proposal.ts)
const ProposalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  triggerSignalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Signal', required: true },
  
  tokenSymbol: String,
  tokenName: String,
  action: { type: String, enum: ['BUY', 'SELL', 'HOLD'] },
  title: String,
  summary: String,
  
  financialImpact: {
    currentValue: Number,
    projectedValue: Number,
    percentChange: Number,
    timeFrame: String,
    riskLevel: String,
  },
  
  // Các trường phân tích từ AI
  reason: [String], 
  sources: [{ name: String, url: String }],

  confidence: Number,
  status: { type: String, default: 'ACTIVE' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
});

// Khởi tạo Models
const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);
const SignalModel = mongoose.models.Signal || mongoose.model("Signal", SignalSchema);
const ProposalModel = mongoose.models.Proposal || mongoose.model("Proposal", ProposalSchema);

const main = async () => {
  try {
    // --- BƯỚC 1: KẾT NỐI DB ---
    console.log("🔌 Connecting to MongoDB...", MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log("✅ DB Connected.");

    // --- BƯỚC 2: LẤY SIGNAL MỚI NHẤT ---
    // Lấy signal được tạo gần đây nhất (createdAt giảm dần)
    const signal = await SignalModel.findOne().sort({ createdAt: -1 });

    if (!signal) {
      console.error("❌ No signals found in DB. Please run 'seedSignals.ts' first.");
      process.exit(1);
    }
    
    // Kiểm tra hạn sử dụng (Optional: Tạm thời comment để test dễ hơn)
    // if (new Date(signal.expiresAt) < new Date()) {
    //    console.warn("⚠️ Warning: The latest signal has expired.");
    // }

    const signalId = signal._id.toString();
    console.log(`📡 Using Latest Signal: ${signalId} (Token: ${signal.tokenAddress})`);

    // --- BƯỚC 3: LẤY DANH SÁCH USER ---
    const users = await UserModel.find({});
    if (users.length === 0) {
      console.error("❌ No users found. Please create a user on the Dashboard first.");
      process.exit(1);
    }
    console.log(`👥 Found ${users.length} Users. Starting AI generation...`);

    // --- BƯỚC 4: IMPORT GRAPH ---
    // Dynamic import để đảm bảo DB đã connect trước khi load logic
    const { initProposalGeneratorGraph } = await import("../src/index");

    // --- BƯỚC 5: CHẠY VÒNG LẶP (Generate Proposal cho từng User) ---
    for (const user of users) {
      console.log(`\n🤖 ---------------------------------------------------`);
      console.log(`🤖 Processing User: ${user._id} | Risk: ${user.riskTolerance || 'N/A'}`);

      try {
        // Khởi tạo Graph với context cụ thể
        const { graph, config } = await initProposalGeneratorGraph(signalId, user._id.toString());

        // Chạy Graph
        // Graph sẽ tự động chạy qua: Validation -> DataFetch -> Generation -> SaveToDb (Node cũ)
        const result = await graph.invoke({}, config);
        
        // --- BƯỚC 6: CHUẨN HÓA DỮ LIỆU & LƯU (Double Check) ---
        // Dù node saveToDb đã chạy, ta sẽ thực hiện logic lưu đè ở đây 
        // để đảm bảo mapping trường dữ liệu chính xác tuyệt đối với Dashboard (UI)
        
        const aiProposal = result.proposal; // Kết quả từ AI trả về

        if (aiProposal) {
          // Mapping dữ liệu để khớp với Schema Proposal.ts của Dashboard
          // Dashboard dùng: triggerSignalId, userId, action...
          const finalProposalData = {
            userId: user._id,
            triggerSignalId: signal._id, // Quan trọng: Dashboard dùng field này để link signal

            tokenSymbol: aiProposal.tokenSymbol || "TOKEN", // Fallback nếu AI không trả về
            tokenName: aiProposal.tokenName || "Crypto Asset",
            
            // Map type (AI) -> action (UI)
            action: (aiProposal.type === 'trade' || aiProposal.type === 'opportunity') ? 'BUY' : 'HOLD',
            
            title: aiProposal.title,
            summary: aiProposal.summary,
            reason: aiProposal.reason || [],
            sources: aiProposal.sources || [],

            financialImpact: {
              currentValue: aiProposal.financialImpact?.currentValue || 0,
              projectedValue: aiProposal.financialImpact?.projectedValue || 0,
              percentChange: aiProposal.financialImpact?.percentChange || 0,
              timeFrame: aiProposal.financialImpact?.timeFrame || "24h",
              riskLevel: aiProposal.financialImpact?.riskLevel || user.riskTolerance || "MEDIUM",
            },

            confidence: aiProposal.confidence || 0.85,
            
            // Set thời gian
            createdAt: new Date(),
            expiresAt: signal.expiresAt || new Date(Date.now() + 48 * 60 * 60 * 1000),
            status: 'ACTIVE'
          };

          // Xóa proposal cũ của user này với signal này (tránh duplicate)
          await ProposalModel.deleteMany({ userId: user._id, triggerSignalId: signal._id });

          // Tạo mới
          const savedDoc = await ProposalModel.create(finalProposalData);
          console.log(`✅ [SUCCESS] Proposal saved for user ${user._id}`);
          console.log(`📝 Title: ${savedDoc.title}`);
        } else {
          console.warn(`⚠️ [SKIP] No proposal generated for user ${user._id}`);
        }

      } catch (err: any) {
        console.error(`❌ [ERROR] Failed processing user ${user._id}:`, err.message);
      }
    }

  } catch (error) {
    console.error("❌ Fatal Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Done. Disconnected.");
    process.exit(0);
  }
};

main();