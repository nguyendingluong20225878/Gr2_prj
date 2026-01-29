// core/proposal-generator/scripts/generateProposal.ts
import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose"; // Đây là instance mongoose CỤC BỘ của proposal-generator

// 1. Load biến môi trường và Debug đường dẫn
// Sử dụng process.cwd() để đảm bảo tìm đúng file .env ngay tại thư mục chạy lệnh
const envPath = path.resolve(process.cwd(), ".env");
console.log(`[Script] Loading .env from: ${envPath}`);
const envConfig = dotenv.config({ path: envPath });

if (envConfig.error) {
  console.warn(`⚠️ Warning: Could not find .env file at ${envPath}`);
}

// 2. Import các module sau khi đã load Env
import { connectToDatabase as connectShared } from "../../shared/src/db/connection";
import { usersTable } from "../../shared/src/db/schema/users";
import { signalsTable } from "../../shared/src/db/schema/signals";
import { ProposalModel } from "../src/db/schema/proposals"; 
import { createProposalWorkflow } from "../src/index";

async function main() {
  try {
    // Kiểm tra API Key
    if (!process.env.GOOGLE_API_KEY) {
      console.error("\n❌ FATAL ERROR: GOOGLE_API_KEY is missing or empty.");
      console.error("👉 Please open file .env and fill in your API Key: GOOGLE_API_KEY=AIzaSy...");
      process.exit(1);
    }

    const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI is missing in .env");
      process.exit(1);
    }

    console.log("🔌 Connecting to Databases...");

    // === BƯỚC QUAN TRỌNG NHẤT ĐỂ SỬA LỖI TIMEOUT ===
    // 1. Kết nối Shared Mongoose (để dùng usersTable, signalsTable)
    await connectShared();
    console.log("✅ Shared DB Connected (Users/Signals).");

    // 2. Kết nối Local Mongoose (để dùng ProposalModel)
    // Phải kết nối lại cái này vì ProposalModel dùng instance mongoose khác với Shared
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
      console.log("✅ Local DB Connected (Proposals).");
    }
    // ===============================================

    // Lấy dữ liệu
    const users = await usersTable.find().lean();
    const activeSignals = await signalsTable.find({
      expiresAt: { $gt: new Date() }
    }).lean();

    console.log(`\n👥 Found ${users.length} Users and ${activeSignals.length} Active Signals.`);

    const workflow = createProposalWorkflow();

    for (const user of users) {
      const userId = (user as any)._id.toString();

      // Dùng ProposalModel để lọc trùng (Lúc này đã có kết nối nên sẽ không bị timeout)
      const processedIds = await ProposalModel.find({ userId }).distinct("triggerEventId");

      const newSignals = activeSignals.filter(
        (sig: any) => !processedIds.includes(sig._id.toString())
      );

      if (newSignals.length === 0) {
        console.log(`[Script] User ${userId}: No new signals.`);
        continue;
      }

      console.log(`[Script] User ${userId}: Processing ${newSignals.length} new signals...`);

      for (const signal of newSignals) {
        try {
          const signalId = (signal as any)._id.toString();
          
          await workflow.invoke(
            {}, 
            { configurable: { userId, signalId } }
          );

          console.log(`✅ [DONE] Proposal created for Signal ${signalId}`);
        } catch (err: any) {
          console.error(`❌ [ERROR] Signal ${(signal as any)._id}:`, err.message);
        }
      }
    }

  } catch (error) {
    console.error("\n❌ Fatal Error:", error);
  } finally {
    // Ngắt kết nối cả 2 instance khi xong
    await mongoose.disconnect(); 
    // Nếu connectShared có hàm disconnect riêng thì gọi thêm, nhưng thường mongoose.disconnect() là đủ
    process.exit(0);
  }
}

main();