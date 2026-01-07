import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";
import { 
  MultiSignalResponseSchema, 
  LlmSignalResponse 
} from "./llmZodSchema";
import { buildKnownTokensBlock, signalPromptTemplate } from "./prompt";
import { DetectorParams } from "./types";

export async function detectSignalWithLlm(params: DetectorParams): Promise<LlmSignalResponse> {
  const { formattedTweets, knownTokens } = params;

  // 1. Cấu hình Model
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini", 
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  // 2. Parser: Dùng Schema mới (Array)
  const parser = StructuredOutputParser.fromZodSchema(MultiSignalResponseSchema);
  const formatInstructions = parser.getFormatInstructions();

  // 3. Chuẩn bị dữ liệu
  const knownTokensBlock = buildKnownTokensBlock(knownTokens);
  
  // Rút gọn tweet để tiết kiệm token
  const slimTweets = formattedTweets.map(t => ({
      id: t.id,
      text: t.text,
      author: t.author,
      time: t.time
  }));

  // 4. Call AI
  try {
    console.log(`[Detector] Aggregating ${formattedTweets.length} tweets for ${knownTokens.length} tokens...`);
    
    // Format template
    const prompt = await signalPromptTemplate.format({
      knownTokensBlock: knownTokensBlock,
      formattedTweets: JSON.stringify(slimTweets, null, 2),
      formatInstructions: formatInstructions, 
    });

    // Gọi model
    const response = await model.invoke(prompt);

    // 5. Parse kết quả
    let contentString = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    
    // === FIX LỖI PARSE ===
    // Gỡ bỏ các ký tự markdown ```json và ``` nếu AI lỡ thêm vào
    contentString = contentString.replace(/```json/g, "").replace(/```/g, "").trim();
    // =====================

    const parsedResult = await parser.parse(contentString);
    
    // Lọc kết quả: Chỉ lấy những signalDetected = true
    const validSignals = parsedResult.signals.filter(s => s.signalDetected);

    console.log(`[Detector] AI Identified ${validSignals.length} valid signals.`);
    return {
      signals: validSignals
    };

  } catch (error) {
    console.error("[Detector] Error during LLM aggregation:", error);
    // Trả về mảng rỗng để không crash
    return { signals: [] };
  }
}