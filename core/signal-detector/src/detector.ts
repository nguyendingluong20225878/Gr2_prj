// core/signal-detector/src/detector.ts
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { MultiSignalResponseSchema, LlmSignalResponse } from "./llmZodSchema";
import { buildKnownTokensBlock, signalPromptTemplate } from "./prompt";
import { DetectorParams } from "./types";
import { GeminiClient } from "../../shared/src/utils/gemini-client"; // Import từ shared

// Khởi tạo Client với Key Rotation
const getGeminiClient = () => {
  return new GeminiClient({
    apiKeys: [
      process.env.GOOGLE_API_KEY_DETECTOR,
    
    ].filter((k): k is string => !!k), // Lọc key undefined
    modelName: "gemini-1.5-flash", // Hoặc flash-latest
    temperature: 0.1,
  });
};

/**
 * Helper: Lấy username từ URL tweet
 */
function getUsernameFromUrl(url: string): string {
  try {
    const match = url.match(/x\.com\/([^\/]+)\/status/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function detectSignalWithLlm(params: DetectorParams): Promise<LlmSignalResponse> {
  const { formattedTweets, knownTokens } = params;

  // 1. Parser
  const parser = StructuredOutputParser.fromZodSchema(MultiSignalResponseSchema);
  const formatInstructions = parser.getFormatInstructions();

  // 2. Chuẩn bị dữ liệu prompt
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

    // 4. GỌI API (Sử dụng GeminiClient Shared)
    const gemini = getGeminiClient();
    const rawResponseText = await gemini.generateJson(promptContent);

    // 5. Clean & Parse JSON
    // Remove markdown code block if exists
    let contentString = rawResponseText.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();

    const parsedResult = await parser.parse(contentString);
    
    // 6. Enrich Sources (Logic cũ của bạn - Giữ nguyên vì nó quan trọng)
    const validSignals = parsedResult.signals
      .filter(s => s.signalDetected)
      .map(signal => {
        const sources = (signal.relatedTweetIds || []).map(id => {
          const originalTweet = formattedTweets.find(t => t.id === id);
          
          if (originalTweet) {
            let author = originalTweet.author;
            if ((!author || author === 'unknown' || author === 'i') && originalTweet.url) {
                author = getUsernameFromUrl(originalTweet.url);
            }
            return {
              label: `Twitter (@${author})`, 
              url: originalTweet.url || `https://x.com/${author}/status/${id}`
            };
          }
          return { label: "Twitter", url: `https://x.com/i/web/status/${id}` };
        });

        return {
          ...signal,
          sources: sources.length > 0 ? sources : signal.sources 
        };
      });

    console.log(`[Detector] AI Identified ${validSignals.length} valid signals.`);
    return { signals: validSignals };

  } catch (error) {
    console.error("[Detector] Error during LLM aggregation:", error);
    // Trả về mảng rỗng thay vì crash
    return { signals: [] };
  }
}