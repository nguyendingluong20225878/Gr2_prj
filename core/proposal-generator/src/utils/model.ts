// import process from "node:process";
/**
 * Hàm chờ (Sleep) để retry
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Class giả lập LangChain Model nhưng chạy bằng Fetch API trực tiếp tới Google
 * Giúp tránh lỗi xung đột thư viện và lỗi "Unknown author"
 */
class GeminiDirectClient {
  private apiKey: string;
  private modelName: string;

  constructor(config: { apiKey: string; modelName: string }) {
    this.apiKey = config.apiKey;
    this.modelName = config.modelName;
  }

  /**
   * Mô phỏng hàm .invoke() của LangChain
   * Input: string prompt
   * Output: { content: string } (JSON string)
   */
  async invoke(promptText: string): Promise<{ content: string }> {
    // URL REST API của Google Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            // Cấu hình ép trả về JSON để Proposal Generator chạy ổn định
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
              responseMimeType: "application/json" 
            },
            // Tắt bộ lọc an toàn để tránh block nội dung Crypto/Finance
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
          })
        });

        // 1. Thành công
        if (response.ok) {
          const data = await response.json();
          // Trích xuất text từ cấu trúc phản hồi của Gemini
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (!text) {
             console.warn("[Gemini] Empty response received.");
             throw new Error("Gemini returned empty response.");
          }
          
          // Trả về format giống LangChain Message object để tương thích với code cũ
          return { content: text };
        }

        // 2. Xử lý Rate Limit (429)
        if (response.status === 429) {
          console.warn(`[Gemini] ⚠️ Quá tải (429). Đang chờ 60s để thử lại (Lần ${attempt}/${maxRetries})...`);
          await sleep(60000); // Chờ 1 phút
          continue; // Thử lại vòng lặp
        }

        // 3. Lỗi 404 (Model Not Found) -> Log rõ ràng
        if (response.status === 404) {
             const errText = await response.text();
             throw new Error(`Gemini Model 404 Not Found (${this.modelName}). Hãy kiểm tra lại danh sách model khả dụng. Chi tiết: ${errText}`);
        }

        // 4. Các lỗi khác
        const errText = await response.text();
        throw new Error(`Gemini Error ${response.status}: ${errText}`);

      } catch (error: any) {
        // Nếu là lỗi mạng (fetch failed), thử lại sau 5s
        if (attempt < maxRetries && (error.message.includes("fetch") || error.message.includes("network"))) {
          console.warn(`[Gemini] Lỗi mạng. Chờ 5s...`);
          await sleep(5000);
          continue;
        }
        // Nếu đã hết lượt retry hoặc lỗi không thể retry
        throw error;
      }
    }
    throw new Error("Failed to call Gemini API after multiple retries.");
  }
}

/**
 * Factory function thay thế hàm cũ
 * Sử dụng Key riêng (GOOGLE_API_KEY_PROPOSAL) nếu có để tránh Rate Limit chung
 */
// SỬA TẠI ĐÂY: Đã đổi sang gemini-2.0-flash (Model có trong danh sách của bạn)
export function getProposalChatModel(modelName: string = "gemini-2.0-flash") {
  // Ưu tiên dùng GOOGLE_API_KEY_PROPOSAL (Project riêng), nếu không thì fallback về KEY chung
  const apiKey = process.env.GOOGLE_API_KEY_PROPOSAL || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    console.error("❌ MISSING GOOGLE_API_KEY (or GOOGLE_API_KEY_PROPOSAL) in .env");
    return null;
  }

  // Khởi tạo Client trực tiếp
  return new GeminiDirectClient({
    apiKey: apiKey,
    modelName: modelName 
  });
}