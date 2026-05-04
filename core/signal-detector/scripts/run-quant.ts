import dotenv from "dotenv";
dotenv.config();

import { 
  connectToDatabase, 
  newsArticlesTable, 
  tweetTable, 
  tokensTable, 
  signalsTable 
} from "@gr2/shared";

import { detectSignalWithFinBertQuant } from "../src/quant-engine.js"; 

async function main() {
  console.log("🚀 KHỞI ĐỘNG HỆ THỐNG QUANT ĐỊNH LƯỢNG NDL...");
  await connectToDatabase();

  // NỚI LỎNG THỜI GIAN: Lấy data trong 3 ngày qua (Bao gồm cả bài báo ngày 25/04)
  const timeWindow = new Date();
  timeWindow.setDate(timeWindow.getDate() - 3);

  console.log(`Đang tìm kiếm Data từ mốc: ${timeWindow.toISOString()}...`);

  // ==========================================
  // 1. KÉO CẢ NEWS VÀ TWEETS TỪ MONGODB
  // ==========================================
  const rawNews = await newsArticlesTable.find({ 
    publishedAt: { $gte: timeWindow } 
  }).lean();
  
  const rawTweets = await tweetTable.find({ 
    createdAt: { $gte: timeWindow },
    isSignalGenerated: { $ne: true } 
  } as any).lean();
  
  const rawTokens = await tokensTable.find().lean();

  if (rawNews.length === 0 && rawTweets.length === 0) {
    console.log("Không có News hay Tweets mới để phân tích. Hệ thống tự động thoát.");
    process.exit(0);
  }

  console.log(`Đã tìm thấy ${rawNews.length} bài News và ${rawTweets.length} Tweets mới!`);

  // ==========================================
  // 2. ÉP KIỂU SANG FORMAT CỦA QUANT ENGINE
  // ==========================================
  const formattedNews = rawNews.map((n: any) => ({
    siteUrl: n.siteUrl || "",
    articleUrl: n.articleUrl || n.url, 
    title: n.title || "",
    summary: n.summary || "",
    content: n.content || "",
    publishedAt: n.publishedAt,
    scrapedAt: n.scrapedAt,
    detectedTokens: n.detectedTokens || [],
  }));

  const formattedTweets = rawTweets.map((t: any) => ({
    id: t._id.toString(),
    text: t.content,
    author: t.authorId,
    time: t.tweetTime,
    url: t.url,
    replyCount: t.replyCount || 0,
    retweetCount: t.retweetCount || 0,
    likeCount: t.likeCount || 0,
    authorWeight: 1, 
  }));

  const knownTokens = rawTokens.map((tk: any) => ({
    address: tk._id.toString(),
    symbol: tk.symbol,
    name: tk.name,
  }));

  // ==========================================
  // 3. CHẠY QUANT ENGINE
  // ==========================================
  console.log(`Đang bơm dữ liệu vào AI FinBERT và xử lý Z-Score...`);
  const quantResults = await detectSignalWithFinBertQuant({
    formattedNews,
    formattedTweets,
    knownTokens
  });

  // ==========================================
  // 4. LƯU TÍN HIỆU VÀO DATABASE (KHỚP SCHEMA)
  // ==========================================
  console.log(`Đã phân tích xong! Lưu ${quantResults.length} Tín hiệu Thô vào Database...`);
  
  // Tính ngày hết hạn mặc định là 7 ngày sau khi phát hiện
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  for (const result of quantResults) {
    const matchedToken = knownTokens.find(tk => tk.symbol === result.tokenSymbol);
    const tokenAddress = matchedToken ? matchedToken.address : "unknown";

    // Đóng gói mảng sources đúng chuẩn { label, url }
    const mappedSources = [
      ...result.newsEvidences.map(url => ({ label: "News Article", url })),
      ...result.tweetEvidences.map(url => ({ label: "X/Twitter", url }))
    ];

    await signalsTable.updateOne(
      { tokenSymbol: result.tokenSymbol, status: "RAW" }, 
      { 
        $set: {
          tokenSymbol: result.tokenSymbol,
          tokenAddress: tokenAddress,
          quantScore: result.quantScore,
          sentimentType: result.sentimentType,
          suggestionType: "hold",            
          confidence: 0,                         // Điền tạm 0, LLM sẽ tính toán và ghi đè
          rationaleSummary: "Đang chờ AI Phân Tích Lý Do...", // Điền tạm chuỗi
          sources: mappedSources,                // Đưa mảng sources chuẩn vào
          status: "RAW",
          expiresAt: expiresAt,
          updatedAt: new Date()
        },
        $setOnInsert: { 
            detectedAt: new Date(),
            createdAt: new Date() 
        }
      },
      { upsert: true, runValidators: true } // Kích hoạt runValidators để chắc chắn đúng Schema
    );
  }

  // ==========================================
  // 5. ĐÓNG DẤU HOÀN THÀNH CHO TWEETS
  // ==========================================
  const tweetIds = rawTweets.map((t: any) => t._id);
  if (tweetIds.length > 0) {
    await tweetTable.updateMany(
      { _id: { $in: tweetIds } },
      { $set: { isSignalGenerated: true } }
    );
  }

  console.log("✅ HOÀN TẤT PIPELINE! Dữ liệu đã sẵn sàng cho bước suy luận LLM.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ LỖI NGHIÊM TRỌNG TRONG RUNNER:", err);
  process.exit(1);
});