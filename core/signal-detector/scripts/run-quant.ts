import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { detectSignalWithFinBertQuant } from '../src/quant-engine.js';

dotenv.config();

async function main() {
  console.log("🚀 [NDL QUANT] Bắt đầu phiên làm việc...");

  try {
    // 1. Kết nối DB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("📡 Đã kết nối MongoDB.");

    const db = mongoose.connection.db;
    if (!db) throw new Error("Không thể lấy instance Database!");

    // 🚀 [QUYẾT ĐỊNH]: Cố định bảng signals theo yêu cầu của bạn
    const targetCollection = 'signals';

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 2. QUERY DỮ LIỆU ĐẦU VÀO
    const rawNews = await db.collection('news_articles').find({ publishedAt: { $gte: oneDayAgo } }).toArray();
    const rawTweets = await db.collection('tweets').find({ tweetTime: { $gte: oneDayAgo } }).toArray();
    const knownTokensRaw = await db.collection('tokens').find({ type: { $in: ['coin', 'spl'] } }).toArray();

    const formattedNews = rawNews.map((n: any) => ({
      ...n,
      docType: 'news',
      publishedAt: n.publishedAt ?? n.scrapedAt ?? new Date()
    }));

    const formattedTweets = rawTweets.map((t: any) => ({
      docType: 'tweet',
      id: t._id?.toString() ?? t.url ?? '',
      text: t.content || t.text || '',
      author: t.authorId ?? '',
      time: t.tweetTime || t.createdAt || new Date(),
      ...t
    }));

    const knownTokens = knownTokensRaw.map((tk: any) => ({
      ...tk,
      address: tk.address ?? undefined
    }));

    console.log(`📥 Đã tải: ${rawNews.length} tin tức, ${rawTweets.length} tweets.`);

    // 3. NẠP LỊCH SỬ TỪ BẢNG SIGNALS (Dùng tokenSymbol)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const pastSignals = await db.collection(targetCollection).find({
      createdAt: { $gte: sevenDaysAgo }
    }).project({ tokenSymbol: 1, quantScore: 1, createdAt: 1 }).toArray();

    const historicalData: Record<string, any[]> = {};
    pastSignals.forEach((sig: any) => {
      const sym = sig.tokenSymbol as string;
      if (!sym) return;

      if (!historicalData[sym]) historicalData[sym] = [];
      historicalData[sym].push({
        unifiedRaw: sig.quantScore || 0,
        timestamp: new Date(sig.createdAt).getTime()
      });
    });
    console.log(`📚 Đã nạp lịch sử cho ${Object.keys(historicalData).length} tokens từ bảng [${targetCollection}].`);

    // 4. CHẠY ENGINE
    const results = await detectSignalWithFinBertQuant({
      formattedNews,
      formattedTweets,
      knownTokens,
      historicalData
    });

    // 5. LƯU KẾT QUẢ VÀO BẢNG SIGNALS
    if (results.length > 0) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const bulkOps = results.map((res: any) => {
        const symbol = res.tokenSymbol as string || "UNKNOWN";
        const tokenInfo = knownTokens.find((t: any) => t.symbol === symbol);
        const finalAddress = tokenInfo?.address || tokenInfo?._id?.toString() || "unknown";

        return {
          updateOne: {
            filter: {
              tokenSymbol: symbol, // Chỉ dùng tokenSymbol như bạn yêu cầu
              createdAt: { $gte: startOfDay }
            },
            update: {
              $set: {
                tokenSymbol: symbol,
                tokenAddress: finalAddress,
                quantScore: res.quantScore || 0,
                confidence: res.confidence || 0,
                suggestionType: res.suggestionType || 'hold',
                sentimentType: res.sentimentType || 'neutral',
                sources: res.sources || [],
                metadata: {
                  sampleSize: historicalData[symbol]?.length || 0,
                  isNewToken: (historicalData[symbol]?.length || 0) < 3,
                  volatilityFlag: res.volatilityFlag || 0, 
                  processedAt: new Date(),
                  ...(res.metadata || {})
                },
                status: "RAW",
                updatedAt: new Date()
              },
              $setOnInsert: {
                createdAt: new Date()
              }
            },
            upsert: true
          }
        };
      });

      // THỰC THI VÀ LOG CHI TIẾT ĐỂ KIỂM CHỨNG
      console.log(`⏳ Đang thực hiện BulkWrite ${bulkOps.length} lệnh vào bảng [${targetCollection}]...`);
      const writeResult = await db.collection(targetCollection).bulkWrite(bulkOps);
      
      console.log("--------------------------------------------------");
      console.log(`✅ KẾT QUẢ GHI DATABASE THỰC TẾ:`);
      console.log(`   - Số bản ghi mới (Inserted): ${writeResult.upsertedCount}`);
      console.log(`   - Số bản ghi cập nhật (Modified): ${writeResult.modifiedCount}`);
      console.log(`   - Tổng số bản ghi khớp filter: ${writeResult.matchedCount}`);
      console.log("--------------------------------------------------");

      if (writeResult.upsertedCount > 0 || writeResult.modifiedCount > 0) {
        console.log("🎉 THÀNH CÔNG: Dữ liệu đã được ghi nhận xuống đĩa.");
      }

    } else {
      console.log("💡 Không có tín hiệu nào đủ mạnh để tạo ra.");
    }

  } catch (error) {
    console.error("❌ Lỗi thực thi hệ thống Quant:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🏁 Đã ngắt kết nối DB. Hoàn tất.");
  }
}

main();