import { ChatOpenAI } from "@langchain/openai";

export function getProposalChatModel(modelName: "gpt-4o" | "gpt-4o-mini" = "gpt-4o-mini") {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY);
  if (!hasOpenAiKey) return null;

  // Cấu hình bắt buộc Model trả về JSON
  return new ChatOpenAI({ 
    modelName: modelName, 
    temperature: 0, // Đặt bằng 0 để kết quả chính xác và ổn định nhất
    modelKwargs: {
      response_format: { type: "json_object" }
    }
  });
}