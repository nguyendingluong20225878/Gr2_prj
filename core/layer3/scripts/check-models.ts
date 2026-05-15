// layer3/scripts/check-models.ts
import dotenv from 'dotenv';
dotenv.config();

async function checkAvailableModels() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("❌ Không tìm thấy GOOGLE_API_KEY trong file .env");
    return;
  }

  console.log("🔍 Đang kết nối tới Google API để lấy danh sách Model...");
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log("\n✅ DANH SÁCH CÁC MODEL BẠN CÓ THỂ SỬ DỤNG CHO LAYER 3:");
    console.log("---------------------------------------------------------");
    
    // Lọc ra các model hỗ trợ tạo văn bản (generateContent)
    const validModels = data.models.filter((model: any) => 
      model.supportedGenerationMethods.includes("generateContent")
    );

    validModels.forEach((model: any) => {
      console.log(`- Tên Model: \x1b[32m${model.name}\x1b[0m`);
      console.log(`  Mô tả: ${model.description}`);
      console.log(`  Giới hạn Input: ${model.inputTokenLimit} tokens`);
      console.log("---------------------------------------------------------");
    });

  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách model:", error);
  }
}

checkAvailableModels();