// core/proposal-generator/scripts/generateProposal.ts
import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import { ProposalService } from "../src/services/ProposalService";

// 1. Load Env
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

async function main() {
  // Check Env
  if (!process.env.GOOGLE_API_KEY_PROPOSAL) {
    console.error("❌ Missing GOOGLE_API_KEY_PROPOSAL");
    process.exit(1);
  }
  
  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    console.error("❌ Missing MONGODB_URI");
    process.exit(1);
  }

  // 2. Khởi tạo Service
  const service = new ProposalService(mongoUri);

  try {
    // 3. Chạy logic
    await service.processPendingSignals();
    
    // 4. Kết thúc
    process.exit(0);

  } catch (error) {
    console.error("❌ Script Failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();