import { z } from "zod";

// Cấu trúc của 1 tín hiệu đơn lẻ
export const SingleSignalSchema = z.object({
  signalDetected: z.boolean().describe("True if a valid trading signal is found for this token"),
  tokenSymbol: z.string().describe("The symbol of the token (e.g. SOL, JUP) must match Known Tokens list"),
  confidence: z.number().min(0).max(100).describe("Confidence score (0-100) based on consensus of tweets"),
  reason: z.string().describe("Comprehensive analysis explaining WHY (aggregated from multiple tweets)"),
  action: z.enum(["BUY", "SELL", "HOLD"]).describe("Recommended action based on the net sentiment"),
  // Quan trọng: List các ID tweet đã đóng góp vào nhận định này
  relatedTweetIds: z.array(z.string()).describe("Array of tweet IDs that contributed to this specific signal"),
});

// Cấu trúc trả về tổng: Một mảng chứa nhiều tín hiệu
export const MultiSignalResponseSchema = z.object({
  signals: z.array(SingleSignalSchema).describe("List of detected signals, one per relevant Token"),
});

export type LlmSignalResponse = z.infer<typeof MultiSignalResponseSchema>;
export type SingleSignal = z.infer<typeof SingleSignalSchema>;