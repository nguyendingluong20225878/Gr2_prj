import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config();

if (!process.env.GOOGLE_API_KEY_DETECTOR) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

async function listModels() {
  const apiKey = process.env.GOOGLE_API_KEY_DETECTOR;
  if (!apiKey) {
    console.error("❌ Lỗi: Chưa cấu hình GOOGLE_API_KEY_DETECTOR trong file .env");
    return;
  }

  console.log("🔑 Đang kiểm tra Key:", apiKey.substring(0, 10) + "...");
  
  // Endpoint để lấy danh sách model
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ API Trả về lỗi ${response.status}:`);
      console.error(JSON.stringify(data, null, 2));
      return;
    }

    if (!data.models) {
      console.log("⚠️ Không tìm thấy model nào. Có thể Key bị giới hạn quyền/khu vực.");
      return;
    }

    console.log("\n✅ DANH SÁCH MODEL KHẢ DỤNG CHO KEY CỦA BẠN:");
    console.log("------------------------------------------------");
    // Lọc chỉ lấy các model có hỗ trợ generateContent
    const chatModels = data.models.filter((m: any) => 
      m.supportedGenerationMethods.includes("generateContent")
    );

    chatModels.forEach((m: any) => {
      console.log(`- ${m.name.replace('models/', '')}`); // In ra tên ngắn gọn
    });
    console.log("------------------------------------------------");
    console.log("👉 Hãy copy một tên ở trên vào file detector.ts");

  } catch (error) {
    console.error("❌ Lỗi kết nối:", error);
  }
}

listModels();