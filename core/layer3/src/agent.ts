// layer3/src/agent.ts
import { StateGraph, END } from "@langchain/langgraph";
import { ProposalState } from "./state.js";
import dotenv from 'dotenv';

dotenv.config();

async function reasoningNode(state: ProposalState): Promise<Partial<ProposalState>> {
  const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY_PROPOSAL;
  if (!googleApiKey) {
    throw new Error("GOOGLE_API_KEY or GOOGLE_API_KEY_PROPOSAL is required for Layer3 reasoning");
  }
  const maxOutputTokens = Number(process.env.LAYER3_MAX_OUTPUT_TOKENS ?? 4096);
  const safeMaxOutputTokens = Number.isFinite(maxOutputTokens) && maxOutputTokens >= 512
    ? Math.floor(maxOutputTokens)
    : 4096;

  //  Prompt tập trung vào phân tích SÂU: Kết hợp Quant + RAG
  const promptText = `Bạn là một Chuyên gia Phân tích Định lượng Crypto.
Viết MỘT ĐOẠN VĂN DUY NHẤT (không tiêu đề, không xuống dòng, không gạch đầu dòng) bằng Tiếng Việt để giải thích quyết định giao dịch cho token ${state.tokenSymbol || "UNKNOWN"}.

DỮ LIỆU ĐẦU VÀO:
- Lệnh: ${(state.suggestionType || "HOLD").toUpperCase()}
- Z-Score: ${(state.quantScore || 0).toFixed(2)}
- Độ tự tin: ${((state.confidence || 0) * 100).toFixed(1)}%
- Nội dung Tin tức/Twitter: 
${state.sourcesContent || "Không có nội dung tin tức, chỉ dựa vào dữ liệu On-chain."}

YÊU CẦU PHÂN TÍCH (Làm gộp trong 1 đoạn văn liền mạch):
1. Khẳng định ngay khuyến nghị ${(state.suggestionType || "HOLD").toUpperCase()} và trích dẫn mức Z-Score.
2. Dựa vào "Nội dung Tin tức/Twitter" ở trên, hãy tóm tắt nội dung chính và giải thích TẠI SAO tin tức đó kết hợp với Z-Score lại dẫn đến quyết định này (Ví dụ: tin tức tốt nhưng Z-score chưa đủ cao nên vẫn HOLD, hoặc tin tức xấu xác nhận Z-score thấp...). Nếu không có tin tức, hãy giải thích dựa trên động lượng dòng tiền on-chain.
3. NẾU Độ tự tin <= 40%, thêm đúng 1 câu này ở cuối cùng: "Lưu ý: Đây là Tín hiệu Khởi động lạnh, thiếu dữ liệu lịch sử đối chiếu nên cần thận trọng."

Văn bản đầu ra:`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.2, 
        maxOutputTokens: safeMaxOutputTokens
      },
      // TẮT HOÀN TOÀN BỘ LỌC AN TOÀN (Bắt buộc với dự án Crypto)
      safetySettings: [
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google API Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  
  // 🚀 [DEBUG LOG]: In ra lý do tại sao AI lại dừng viết
  const finishReason = data.candidates?.[0]?.finishReason;
  console.log(`[DEBUG] Lý do AI hoàn thành text: ${finishReason}`);

  // Trích xuất text an toàn
  const rationaleSummary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Không có phản hồi từ AI.";

  return { rationaleSummary };
}

export const layer3Graph = new StateGraph<ProposalState>({
  channels: {
    signalId: { value: (a, b) => b ?? a },
    tokenSymbol: { value: (a, b) => b ?? a },
    quantScore: { value: (a, b) => b ?? a },
    confidence: { value: (a, b) => b ?? a },
    suggestionType: { value: (a, b) => b ?? a },
    sourcesContent: { value: (a, b) => b ?? a },
    rationaleSummary: { value: (a, b) => b ?? a },
    messages: { value: (a, b) => a.concat(b) },
  }
})
  .addNode("reasoning", reasoningNode)
  .addEdge("__start__", "reasoning")
  .addEdge("reasoning", END)
  .compile();
