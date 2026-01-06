//mapping & lưu LLM signal vào DB MongoDB.
import type { LlmSignalResponse } from "./types";

export function mapLlmResponseToSignalInsert(resp: LlmSignalResponse) {
  const detectedAt = new Date();

  // Map numeric sentiment (-1..1) to the project's sentiment buckets
  let sentimentType: "positive" | "negative" | "neutral" = "neutral";
  if (resp.sentimentScore > 0.1) sentimentType = "positive";
  else if (resp.sentimentScore < -0.1) sentimentType = "negative";

  const confidence = resp.confidence ?? 0;

  const rationaleSummary = (resp.reasoning || "").slice(0, 2000);
  //Thời gian hết hạn signal
  const expiresAt = new Date(detectedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  const insert = {
    tokenAddress: resp.tokenAddress,
    detectedAt,
    sources: resp.sources.map((s) => ({ label: s.label, url: s.url })),
    sentimentType,
    suggestionType: resp.suggestionType,
    confidence,
    rationaleSummary,
    expiresAt,
  };

  return insert;
}

//nếu phát hiện tín hiệu, lưu vào DB MongoDB
export async function saveSignalToDb(resp: LlmSignalResponse) {
  if (!resp.signalDetected) {
    // Skip storing non-signals
    return null;
  }

  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    console.warn("saveSignalToDb: MONGODB_URI not set; skipping persistence");
    return null;
  }

  
  const shared = await import("../../shared/src/index.js");
  const { connectToDatabase, signalsTable, logProcessing, logSuccess, logFailed } = shared as any;

  try {
    await connectToDatabase();

    await logProcessing(
      "Signal-Detector",
      `Detecting signal for token ${resp.tokenAddress}...`,
      { tokenAddress: resp.tokenAddress, sentiment: resp.sentimentScore }
    );

    const insert = mapLlmResponseToSignalInsert(resp);
    const created = await signalsTable.create(insert as any);

    await logSuccess(
      "Signal-Detector",
      `Detected ${insert.sentimentType} signal for ${resp.tokenAddress} with ${Math.round(insert.confidence * 100)}% confidence`,
      { 
        tokenAddress: resp.tokenAddress, 
        sentiment: insert.sentimentType,
        confidence: insert.confidence,
        suggestion: insert.suggestionType
      }
    );

    return created;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logFailed(
      "Signal-Detector",
      `Failed to save signal for ${resp.tokenAddress}: ${errorMessage}`,
      { tokenAddress: resp.tokenAddress, error: errorMessage }
    );
    throw error;
  }
}
