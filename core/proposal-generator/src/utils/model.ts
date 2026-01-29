// Bỏ import ChatOpenAI
// import { ChatOpenAI } from "@langchain/openai";

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
   */
  async invoke(promptText: string): Promise<{ content: string }> {
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
            // Tắt bộ lọc an toàn
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
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) throw new Error("Gemini returned empty response.");
          
          // Trả về format giống LangChain Message object
          return { content: text };
        }

        // 2. Xử lý Rate Limit (429)
        if (response.status === 429) {
          console.warn(`[Gemini] ⚠️ Quá tải (429). Chờ 60s thử lại (${attempt}/${maxRetries})...`);
          await sleep(60000);
          continue;
        }

        // 3. Lỗi khác
        const errText = await response.text();
        throw new Error(`Gemini Error ${response.status}: ${errText}`);

      } catch (error: any) {
        if (attempt < maxRetries && (error.message.includes("fetch") || error.message.includes("network"))) {
          await sleep(5000);
          continue;
        }
        throw error;
      }
    }
    throw new Error("Failed to call Gemini API after retries.");
  }
}

/**
 * Factory function thay thế hàm cũ
 */
export function getProposalChatModel(modelName: string = "gemini-flash-latest") {
  // Ưu tiên dùng GOOGLE_API_KEY
  const apiKey = process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    console.error("❌ MISSING GOOGLE_API_KEY in .env");
    return null;
  }

  // Dùng model name đã được kiểm chứng ở module trước
  // Bạn có thể đổi thành "gemini-1.5-flash" hoặc "gemini-2.0-flash" tùy key
  const targetModel = "gemini-flash-latest"; 

  return new GeminiDirectClient({
    apiKey: apiKey,
    modelName: targetModel
  });
}