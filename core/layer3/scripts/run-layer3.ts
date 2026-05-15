import dotenv from 'dotenv';
dotenv.config(); 

import mongoose from 'mongoose';
import { layer3Graph } from '../src/agent.js';
import path from 'path';
// 🚀 [FIX BUG 1]: Bổ sung proposalsTable vào danh sách import
import { 
  connectToDatabase, 
  signalsTable, 
  newsArticlesTable, 
  tweetTable, 
  proposalsTable 
} from '../../shared/src/index.js'; 

dotenv.config();

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function runLayer3() {
  console.log("🚀 [LAYER 3] Khởi động AI Reasoning Pipeline (Event-Driven)...");
  
  try {
    await connectToDatabase();
    console.log("📡 Đã kết nối MongoDB.");

    const rawSignals = await signalsTable.find({ status: "RAW" }).limit(10).lean();
    
    if (rawSignals.length === 0) {
      console.log("💡 Không có tín hiệu RAW nào cần xử lý.");
      return;
    }

    console.log(`[Layer 3] Tìm thấy ${rawSignals.length} tín hiệu cần phân tích.`);

    for (const signal of rawSignals) {
      let combinedSources = "";
      const safeSources = (signal as any).sources || []; 

      for (const source of safeSources) {
        try {
          if (source.label === 'News Article') {
            const article = await newsArticlesTable.findOne({ articleUrl: source.url }).lean();
            if (article) {
              // 🚀 Ưu tiên lấy 'content' đầy đủ, nếu không có mới dùng 'summary'
              const textContent = article.content || article.summary || "Không có nội dung văn bản";
              combinedSources += `[Báo chí - ${article.title}]\nNội dung: ${textContent}\n\n`;
            } else {
              combinedSources += `[Báo chí (Mất nội dung, tự suy luận từ URL)]: ${source.url}\n\n`;
            }
          } else if (source.label === 'X (Twitter)') {
             const tweet = await tweetTable.findOne({ url: source.url }).lean();
             if (tweet) {
                 const rawText = String(tweet.text || tweet.content || "");
                 const cleanText = rawText.replace(/https:\/\/t\.co\/\w+/g, '').trim();
                 combinedSources += `[Tweet từ KOL]: ${cleanText}\n\n`;
             } else {
                 combinedSources += `[Tweet (Mất nội dung)]: ${source.url}\n\n`;
             }
          }
        } catch (sourceError) {
          console.warn(`⚠️ Bỏ qua source ${source.url} do lỗi DB:`, sourceError);
        }
      }

      const safeSourcesContent = combinedSources.slice(0, 100000);

      const initialState = {
        signalId: (signal as any)._id.toString(),
        tokenSymbol: (signal as any).tokenSymbol || "UNKNOWN",
        quantScore: (signal as any).quantScore || 0,
        confidence: (signal as any).confidence || 0,
        suggestionType: (signal as any).suggestionType || "hold",
        sourcesContent: safeSourcesContent || "Không có nội dung văn bản cụ thể.", 
        messages: []
      };

      console.log(`⏳ Đang chạy Gemini AI suy luận cho token: ${initialState.tokenSymbol}...`);
      
      try {
        const finalState = await layer3Graph.invoke(initialState);

        await proposalsTable.updateOne(
          { signalId: (signal as any)._id }, 
          { 
            $set: { 
              tokenSymbol: (signal as any).tokenSymbol,
              tokenAddress: (signal as any).tokenAddress,
              suggestionType: (signal as any).suggestionType,
              sentimentType: (signal as any).sentimentType,
              quantScore: (signal as any).quantScore,
              confidence: (signal as any).confidence,
              sources: (signal as any).sources,
              rationaleSummary: finalState.rationaleSummary,
              executionStatus: "PENDING", 
              updatedAt: new Date()
            },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );

        await signalsTable.updateOne(
          { _id: (signal as any)._id },
          { 
            $set: { 
              status: "PROCESSED",
              updatedAt: new Date()
            } 
          }
        );
        
        console.log(`✅ Đã tạo Proposal mới cho: ${initialState.tokenSymbol}`);
      } catch (graphError) {
        console.error(`❌ Lỗi khi phân tích ${(signal as any).tokenSymbol}, chuyển status sang FAILED.`, graphError);
        await signalsTable.updateOne(
          { _id: (signal as any)._id },
          { $set: { status: "FAILED" } }
        );
      }

      await delay(15000); 
    }

  } catch (error) {
    console.error("❌ [Layer 3] Lỗi thực thi tổng thể:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🏁 Đã ngắt kết nối DB. Hoàn tất Layer 3.");
    process.exit(0);
  }
}

// ✅ FIX LỖI 2: Thay thế import.meta.url bằng cách kiểm tra tương thích với CommonJS
const isMain = process.argv[1] && 
  (process.argv[1].endsWith('run-layer3.ts') || 
   process.argv[1].endsWith('run-layer3.js') ||
   process.argv[1].includes('run-layer3'));

if (isMain) {
  runLayer3().catch(console.error);
}