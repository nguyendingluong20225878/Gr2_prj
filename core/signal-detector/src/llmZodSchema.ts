import { z } from "zod";

export const LlmSignalResponseZod = z.object({
  signalDetected: z.boolean(),
  tokenAddress: z.string(),
  sources: z.array(z.object({ url: z.string(), label: z.string() })),
  sentimentScore: z.number().min(-1).max(1),
  suggestionType: z.enum(["buy", "sell", "hold", "close_position", "stake"]),
  strength: z.number().nullable().optional(),
  confidence: z.number().nullable().optional(),
  reasoning: z.string(),
  relatedTweetIds: z.array(z.string()),
  reasonInvalid: z.string().nullable().optional(),
  impactScore: z.number().nullable().optional(),
});

export type LlmSignalResponseZodType = z.infer<typeof LlmSignalResponseZod>;
