import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { 
  MultiSignalResponseSchema, 
  LlmSignalResponse 
} from "./llmZodSchema";
import { buildKnownTokensBlock, signalPromptTemplate } from "./prompt";
import { DetectorParams } from "./types";

/**
 * Hàm chờ (Sleep)
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper: Lấy username từ URL tweet nếu dữ liệu author bị thiếu
 * Ví dụ: https://x.com/username/status/123 -> username
 */
function getUsernameFromUrl(url: string): string {
  try {
    const match = url.match(/x\.com\/([^\/]+)\/status/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Hàm gọi trực tiếp Google Gemini qua REST API
 * - Tích hợp Retry (429)
 * - Tích hợp JSON Mode (Fix lỗi cú pháp)
 * - Tắt Safety Filter (Fix lỗi bị cắt nội dung Crypto)
 */
async function callGeminiDirectly(promptText: string): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is missing in .env");

  // Dùng model flash-latest để có hiệu năng tốt nhất
  const modelName = "gemini-flash-latest"; 
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

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
          // 1. Cấu hình sinh nội dung: Bắt buộc JSON
          generationConfig: {
            temperature: 0.1, // Giảm temperature để output ổn định hơn
            maxOutputTokens: 8192, // Tăng max tokens
            responseMimeType: "application/json" // QUAN TRỌNG: Ép kiểu trả về JSON
          },
          // 2. Tắt bộ lọc an toàn (Để tránh bị chặn khi nói về Crypto)
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        })
      });

      // 1. Nếu thành công (200 OK)
      if (response.ok) {
        const data = await response.json();
        const candidate = data?.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;

        // Check lý do dừng (nếu bị filter)
        if (candidate?.finishReason && candidate.finishReason !== "STOP") {
            console.warn(`[Gemini Warning] Finish Reason: ${candidate.finishReason}`);
        }

        if (!text) throw new Error("Gemini returned empty response (Check Safety Filters).");
        return text;
      }

      // 2. Nếu lỗi Rate Limit (429) -> Chờ và Thử lại
      if (response.status === 429) {
        console.warn(`⚠️  Gemini quá tải (429). Đang chờ 60s để thử lại (Lần ${attempt}/${maxRetries})...`);
        await sleep(60000); 
        continue; 
      }

      // 3. Nếu lỗi 404/400
      if (response.status === 404 || response.status === 400) {
        const errorText = await response.text();
        throw new Error(`Gemini Model Error ${response.status} (${modelName}): ${errorText}`);
      }

      // 4. Các lỗi khác
      const errorText = await response.text();
      console.warn(`⚠️  Gemini lỗi ${response.status}. Thử lại sau 5s...`);
      await sleep(5000);
      
      if (attempt === maxRetries) {
         throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
      }

    } catch (error: any) {
      if (attempt < maxRetries && (error.message.includes("fetch") || error.message.includes("network"))) {
        console.warn(`Lỗi kết nối. Thử lại sau 5s...`);
        await sleep(5000);
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to call Gemini API after multiple retries.");
}

export function mapTweetsToSources(tweets: any[]): { label: string; url: string }[] {
  return tweets.map(tweet => {
    // Ưu tiên lấy username từ author object hoặc trường username trực tiếp
    const username = tweet.author?.username || tweet.username || 'i';
    const tweetId = tweet.tweetId || tweet.id;

    return {
      label: `Twitter (@${username})`,
      url: `https://x.com/${username}/status/${tweetId}`
    };
  });
}

export async function detectSignalWithLlm(params: DetectorParams): Promise<LlmSignalResponse> {
  const { formattedTweets, knownTokens } = params;

  // 1. Parser
  const parser = StructuredOutputParser.fromZodSchema(MultiSignalResponseSchema);
  const formatInstructions = parser.getFormatInstructions();

  // 2. Chuẩn bị dữ liệu
  const knownTokensBlock = buildKnownTokensBlock(knownTokens);
  
  const slimTweets = formattedTweets.map(t => ({
      id: t.id,
      text: t.text,
      author: t.author,
      time: t.time
  }));

  try {
    console.log(`[Detector] Aggregating ${formattedTweets.length} tweets for ${knownTokens.length} tokens...`);
    
    // 3. Format Prompt
    const promptContent = await signalPromptTemplate.format({
      knownTokensBlock: knownTokensBlock,
      formattedTweets: JSON.stringify(slimTweets, null, 2),
      formatInstructions: formatInstructions, 
    });

    // 4. GỌI API
    const rawResponseText = await callGeminiDirectly(promptContent);

    // 5. Clean & Parse JSON
    // Vì đã bật responseMimeType: "application/json", Gemini sẽ trả về JSON thuần.
    // Tuy nhiên, ta vẫn nên clean nhẹ để chắc chắn.
    let contentString = rawResponseText.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();

    const parsedResult = await parser.parse(contentString);
    
    // === LOGIC SỬA ĐỔI: ENRICH SOURCES ===
    // Thay vì tin tưởng sources do AI bịa ra (thường sai URL), ta build lại sources từ tweet gốc
    const validSignals = parsedResult.signals
      .filter(s => s.signalDetected)
      .map(signal => {
        // Map lại từ relatedTweetIds sang full source object
        const sources = (signal.relatedTweetIds || []).map(id => {
          const originalTweet = formattedTweets.find(t => t.id === id);
          
          if (originalTweet) {
            // Ưu tiên lấy author từ dữ liệu, nếu không thì parse từ URL
            let author = originalTweet.author;
            // Nếu author rỗng hoặc 'unknown' hoặc 'i', cố gắng lấy từ URL
            if ((!author || author === 'unknown' || author === 'i') && originalTweet.url) {
                author = getUsernameFromUrl(originalTweet.url);
            }

            return {
              label: `Twitter (@${author})`, // Format đúng yêu cầu: Twitter (@Username)
              url: originalTweet.url || `https://x.com/${author}/status/${id}`
            };
          }

          // Fallback nếu không tìm thấy tweet gốc (hiếm khi xảy ra)
          return {
            label: "Twitter",
            url: `https://x.com/i/web/status/${id}`
          };
        });

        return {
          ...signal,
          sources: sources.length > 0 ? sources : signal.sources // Ghi đè bằng sources chuẩn
        };
      });

    console.log(`[Detector] AI Identified ${validSignals.length} valid signals.`);
    return {
      signals: validSignals
    };

  } catch (error) {
    console.error("[Detector] Error during LLM aggregation:", error);
    return { signals: [] };
  }
}