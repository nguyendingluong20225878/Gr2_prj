import dotenv from "dotenv";
import { processNewsScraping } from "../src/process.js";

// Nạp biến môi trường từ file .env
dotenv.config();
console.log('[env] FIRECRAWL_API_KEY set:', !!process.env.FIRECRAWL_API_KEY, 'length=', process.env.FIRECRAWL_API_KEY?.length ?? 0);

(async () => {
  console.log(`[${new Date().toLocaleString()}] 🚀 Bắt đầu tiến trình cào tin tức...`);
  
  try {
    const result = await processNewsScraping();
    
    // Log kết quả dưới dạng JSON đẹp để dễ đọc
    console.log("📊 Kết quả xử lý:");
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log("✅ Tiến trình hoàn thành thành công.");
    } else {
      console.error("⚠️ Tiến trình kết thúc nhưng có lỗi xảy ra:", result.message);
    }

    // Thoát với mã 0 nếu thành công, mã 1 nếu thất bại
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    // Bẫy lỗi cuối cùng nếu hàm processNewsScraping bị crash hoàn toàn
    console.error("❌ Lỗi nghiêm trọng không mong muốn:");
    console.error(error);
    process.exit(1);
  }
})();