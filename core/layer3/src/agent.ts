// layer3/src/agent.ts
import { StateGraph, END } from "@langchain/langgraph";
import { ProposalState } from "./state.js";
import dotenv from 'dotenv';

dotenv.config();

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403]);

export class Layer3ProviderError extends Error {
  provider = "google" as const;
  statusCode?: number;
  retryable: boolean;
  model?: string;
  reason: string;

  constructor(params: {
    message: string;
    statusCode?: number;
    retryable: boolean;
    model?: string;
    reason?: string;
  }) {
    super(params.message);
    this.name = "Layer3ProviderError";
    this.statusCode = params.statusCode;
    this.retryable = params.retryable;
    this.model = params.model;
    this.reason = params.reason ?? params.message;
  }
}

function splitCsv(value: string | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveGoogleApiKeys(): string[] {
  const fromList = splitCsv(process.env.GOOGLE_API_KEYS);
  if (fromList.length > 0) return fromList;

  return [
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_API_KEY_PROPOSAL,
  ].filter((key): key is string => Boolean(key?.trim()));
}

function resolveModelSequence(): string[] {
  const fromEnv = splitCsv(process.env.LAYER3_MODEL_SEQUENCE);
  return fromEnv.length > 0 ? fromEnv : ["gemini-2.5-flash"];
}

function isRetryableFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|network|timeout|ECONN|ETIMEDOUT|ENOTFOUND/i.test(message);
}

function classifyGoogleStatus(statusCode: number) {
  if (RETRYABLE_STATUS_CODES.has(statusCode)) return true;
  if (NON_RETRYABLE_STATUS_CODES.has(statusCode)) return false;
  return statusCode >= 500;
}

async function reasoningNode(state: ProposalState): Promise<Partial<ProposalState>> {
  const googleApiKeys = resolveGoogleApiKeys();
  if (googleApiKeys.length === 0) {
    throw new Layer3ProviderError({
      message: "GOOGLE_API_KEYS, GOOGLE_API_KEY, or GOOGLE_API_KEY_PROPOSAL is required for Layer3 reasoning",
      retryable: false,
      reason: "missing_api_key",
    });
  }
  const models = resolveModelSequence();
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

  let lastRetryableError: Layer3ProviderError | null = null;
  let attemptCount = 0;

  for (const model of models) {
    for (const googleApiKey of googleApiKeys) {
      attemptCount += 1;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${googleApiKey}`;

      let response: Response;
      try {
        response = await fetch(url, {
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const providerError = new Layer3ProviderError({
          message: `Google API network error (${model}): ${message}`,
          retryable: isRetryableFetchError(error),
          model,
          reason: message,
        });
        if (!providerError.retryable) throw providerError;
        lastRetryableError = providerError;
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        const retryable = classifyGoogleStatus(response.status);
        const providerError = new Layer3ProviderError({
          message: `Google API Error: ${response.status} - ${errText}`,
          statusCode: response.status,
          retryable,
          model,
          reason: errText,
        });
        if (!retryable) throw providerError;
        lastRetryableError = providerError;
        continue;
      }

      const data = await response.json();

      // 🚀 [DEBUG LOG]: In ra lý do tại sao AI lại dừng viết
      const finishReason = data.candidates?.[0]?.finishReason;
      console.log(`[DEBUG] Lý do AI hoàn thành text: ${finishReason}; model=${model}${attemptCount > 1 ? `; fallbackAttempts=${attemptCount - 1}` : ""}`);

      // Trích xuất text an toàn
      const rationaleSummary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Không có phản hồi từ AI.";

      return { rationaleSummary };
    }
  }

  throw lastRetryableError ?? new Layer3ProviderError({
    message: "Google API Error: no provider attempt completed",
    retryable: true,
    model: models[0],
    reason: "all_provider_attempts_failed",
  });
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
