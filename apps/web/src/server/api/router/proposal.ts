import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
// Nếu bạn chưa export model, hãy dùng mongoose trực tiếp hoặc import từ file db
import { ProposalModel } from "../../../../../../core/proposal-generator/src/utils/db"; // Ví dụ đường dẫn
// Hoặc nếu bạn dùng mongoose models trực tiếp:
import mongoose from "mongoose";

// Định nghĩa Schema Output để Frontend có Type safe
const ProposalSchema = z.object({
  _id: z.string(),
  title: z.string(),
  tokenSymbol: z.string().optional().default("SOL"), // Tạm thời default vì DB chưa có field này
  confidence: z.number().default(80),
  financialImpact: z.object({
    projectedValue: z.number(),
    currentValue: z.number(),
    riskLevel: z.string(),
  }),
  expiresAt: z.date(),
  status: z.string(),
  reason: z.array(z.string()),
});

export const proposalRouter = createTRPCRouter({
  // 1. Lấy danh sách cho Dashboard
  getDashboard: publicProcedure.query(async () => {
    // Đảm bảo connect DB
    // await dbConnect(); 
    
    // Query Mongoose thật
    // Lấy các proposal đang 'pending'
    const proposals = await mongoose.connection.db.collection('proposals')
        .find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .toArray();

    // Map _id object sang string để không lỗi Serialization
    return proposals.map(p => ({
      ...p,
      _id: p._id.toString(),
      // Fallback các trường thiếu nếu cần
      confidence: 80, 
      tokenSymbol: "SOL" 
    }));
  }),

  // 2. Lấy chi tiết 1 Proposal
  getDetail: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
       const p = await mongoose.connection.db.collection('proposals')
         .findOne({ _id: new mongoose.Types.ObjectId(input.id) });
       
       if (!p) throw new Error("Not Found");
       
       return {
         ...p,
         _id: p._id.toString(),
         confidence: 80,
         tokenSymbol: "SOL"
       };
    }),
});