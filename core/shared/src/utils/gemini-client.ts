// core/shared/src/utils/gemini-client.ts

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface GeminiConfig {
  apiKeys: string[];
  modelName?: string;
  temperature?: number;
}

export class GeminiClient {
  private apiKeys: string[];
  private modelName: string;
  private temperature: number;

  constructor(config: GeminiConfig) {
    // Lọc bỏ các key rỗng/undefined
    this.apiKeys = config.apiKeys.filter((k) => k && k.trim() !== "");
    this.modelName = config.modelName || "gemini-1.5-flash";
    this.temperature = config.temperature || 0.1;

    if (this.apiKeys.length === 0) {
      console.warn("⚠️ GeminiClient: No API Keys provided!");
    }
  }

  private getRandomKey(): string {
    if (this.apiKeys.length === 0) throw new Error("No Google API Keys available.");
    const index = Math.floor(Math.random() * this.apiKeys.length);
    return this.apiKeys[index];
  }

  /**
   * Gọi Gemini API để sinh nội dung JSON
   * @param promptText Nội dung prompt
   * @param maxRetries Số lần thử lại tối đa (Mặc định 3)
   */
  public async generateJson(promptText: string, maxRetries = 3): Promise<string> {
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      const apiKey = this.getRandomKey();
      // Mask key log để bảo mật
      const maskedKey = `...${apiKey.slice(-4)}`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              temperature: this.temperature,
              responseMimeType: "application/json", // Bắt buộc trả về JSON
              maxOutputTokens: 8192,
            },
            // Tắt toàn bộ Safety Filter để tránh lỗi Crypto
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
          }),
        });

        // 1. Success
        if (response.ok) {
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (!text) {
             throw new Error("Gemini returned empty response.");
          }
          return text;
        }

        // 2. Rate Limit (429) -> Thử lại với key khác hoặc chờ
        if (response.status === 429) {
          console.warn(`⚠️ Gemini 429 (Key ${maskedKey}). Waiting 10s... (Attempt ${attempt}/${maxRetries})`);
          await sleep(10000); // Chờ 10s
          continue;
        }

        // 3. Other Errors
        const errorText = await response.text();
        console.warn(`⚠️ Gemini Error ${response.status}: ${errorText}. Retrying...`);
        await sleep(3000);

      } catch (error: any) {
        console.error(`❌ Gemini Network Error: ${error.message}`);
        await sleep(3000);
      }
    }

    throw new Error("Gemini API failed after multiple retries.");
  }
}