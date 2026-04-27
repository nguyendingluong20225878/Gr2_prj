import dotenv from "dotenv";
dotenv.config();

// Sửa lại đường dẫn import DB cho đúng với thư mục thực tế của bạn
import { 
  connectToDatabase, 
  newsArticlesTable, 
  tweetTable, 
  tokensTable, 
  signalsTable 
} from "@gr2/shared";

// Import hàm từ file quant-engine ta vừa sửa
import { detectSignalWithFinBertQuant } from "../src/quant-engine.js"; 

async function main() {
  console.log("🚀 KHỞI ĐỘNG HỆ THỐNG QUANT ĐỊNH LƯỢNG NDL...");
  await connectToDatabase();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // 1. KÉO DỮ LIỆU TỪ MONGODB
  console.log("Đang lấy dữ liệu 24h qua...");
  const rawNews = await newsArticlesTable.find({ publishedAt: { $gte: yesterday } }).lean();
  
  // Chỉ lấy Tweet chưa từng tạo Signal (isSignalGenerated: false)
  const rawTweets = await tweetTable.find({ 
    createdAt: { $gte: yesterday },
    isSignalGenerated: false 
} as any).lean(); 
  
  const rawTokens = await tokensTable.find().lean();

  if (rawNews.length === 0 && rawTweets.length === 0) {
    console.log("Không có dữ liệu mới để phân tích. Hệ thống tự động thoát.");
    process.exit(0);
  }

  // 2. ÉP KIỂU SANG FORMAT CỦA QUANT ENGINE
  const formattedNews = rawNews.map((n: any) => ({
    siteUrl: n.siteUrl,
    articleUrl: n.articleUrl,
    title: n.title,
    summary: n.summary,
    content: n.content,
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

  // 3. CHẠY QUANT ENGINE
  console.log(`Đang chạy FinBERT Quant cho ${formattedNews.length} News và ${formattedTweets.length} Tweets...`);
  const quantResults = await detectSignalWithFinBertQuant({
    formattedNews,
    formattedTweets,
    knownTokens
  });

  // 4. LƯU TÍN HIỆU NHÁP (RAW) VÀO DB ĐỂ CHỜ LLM
  console.log(`Đã phân tích xong. Đang lưu ${quantResults.length} Tín hiệu Thô vào Database...`);
  for (const result of quantResults) {
    await signalsTable.updateOne(
      { tokenSymbol: result.tokenSymbol, status: "RAW" }, // Giả sử bảng signals của bạn có cột status
      { 
        $set: {
          tokenSymbol: result.tokenSymbol,
          sentimentScore: result.quantScore, // Mượn cột sentimentScore lưu Z-Score
          suggestionType: "hold",            // Tạm để hold, LLM sẽ ghi đè sau
          reasoning: "Chờ LLM xử lý",
          relatedTweetIds: [...result.newsEvidences, ...result.tweetEvidences], // Đổ hết link vào đây
          status: "RAW",
          updatedAt: new Date()
        },
        $setOnInsert: { 
            signalDetected: true,
            tokenAddress: "unknown_yet",
            sources: [],
            createdAt: new Date() 
        }
      },
      { upsert: true }
    );
  }

  // 5. ĐÓNG DẤU TWEET ĐÃ XỬ LÝ (Chống lặp)
  const tweetIds = rawTweets.map((t: any) => t._id);
  if (tweetIds.length > 0) {
    await tweetTable.updateMany(
      { _id: { $in: tweetIds } },
      { $set: { isSignalGenerated: true } }
    );
  }

  console.log("✅ HoÀN TẤT! Data đã nằm trong Database, sẵn sàng cho Mô hình LLM phán xử!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ LỖI NGHIÊM TRỌNG TRONG RUNNER:", err);
  process.exit(1);
});