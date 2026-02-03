// core/proposal-generator/src/services/ProposalService.ts
import mongoose from "mongoose";
import { connectToDatabase as connectShared } from "../../../shared/src/db/connection";
import { usersTable } from "../../../shared/src/db/schema/users";
import { signalsTable } from "../../../shared/src/db/schema/signals";
import { ProposalModel } from "../db/schema/proposals";
import { createProposalWorkflow } from "../index";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ProposalService {
  private mongoUri: string;

  constructor(mongoUri: string) {
    this.mongoUri = mongoUri;
  }

  private async connectDbs() {
    // 1. Kết nối Shared (Users, Signals)
    await connectShared();
    
    // 2. Kết nối Local (Proposals)
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(this.mongoUri);
    }
  }

  public async processPendingSignals() {
    console.log("🚀 [ProposalService] Starting batch process...");
    
    try {
      await this.connectDbs();

      // Lấy users và signals còn hạn
      const users = await usersTable.find().lean();
      const activeSignals = await signalsTable.find({
        expiresAt: { $gt: new Date() }
      }).lean();

      console.log(`📊 Found ${users.length} users and ${activeSignals.length} active signals.`);

      const workflow = createProposalWorkflow();

      for (const user of users) {
        const userId = (user as any)._id.toString();

        // Lọc các signal đã xử lý cho user này
        const processedIds = await ProposalModel.find({ userId }).distinct("triggerEventId");
        
        const newSignals = activeSignals.filter(
          (sig: any) => !processedIds.includes(sig._id.toString())
        );

        if (newSignals.length === 0) continue;

        console.log(`👤 User ${userId}: Found ${newSignals.length} new signals.`);

        // Xử lý từng signal
        for (const signal of newSignals) {
          const signalId = (signal as any)._id.toString();
          
          try {
            console.log(`⚡ Processing Signal ${signalId}...`);
            
            // Gọi LangGraph Workflow
            await workflow.invoke(
              {}, 
              { configurable: { userId, signalId } }
            );

            // QUAN TRỌNG: Sleep 10s sau mỗi lần tạo thành công để tránh 429
            console.log("⏳ Cooling down 10s...");
            await sleep(10000);

          } catch (err: any) {
            console.error(`❌ Error Signal ${signalId}:`, err.message);
            // Lỗi thì sleep lâu hơn chút
            await sleep(15000);
          }
        }
      }
      
      console.log("✅ [ProposalService] Batch process finished.");

    } catch (error) {
      console.error("❌ [ProposalService] Critical Error:", error);
      throw error;
    } finally {
        // Tùy chọn: Ngắt kết nối nếu chạy dạng script, 
        // nhưng nếu chạy dạng server/worker thì không nên ngắt.
        // Ở đây ta để script tự quản lý việc exit.
    }
  }
}