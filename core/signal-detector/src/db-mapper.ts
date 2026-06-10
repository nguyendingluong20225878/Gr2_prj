/// <reference types="node" />
import { QuantSignalResponse } from "./types.js"; 

export function mapQuantToMongoInsert(resp: QuantSignalResponse) {
  const detectedAt = new Date();
  const expiresAt = new Date(detectedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // Tín hiệu sống 7 ngày
  const batchStartedAt = process.env.PIPELINE_STARTED_AT
    ? new Date(process.env.PIPELINE_STARTED_AT)
    : detectedAt;
  const batchId = process.env.PIPELINE_RUN_ID || process.env.BATCH_ID || batchStartedAt.toISOString();

  // Map Token 
  const tokenSymbol = resp.tokenSymbol || "UNKNOWN";
  const tokenAddress = resp.tokenAddress || "unknown_address";

  // Object Insert chuẩn Quant V3
  const insert = {
    tokenSymbol,
    tokenAddress,
    signalDetected: true,
    detectedAt,
    expiresAt,
    batchId,
    batchStartedAt,

    // Điểm số đặc trưng của V3
    quantScore: resp.quantScore || 0,
    volatilityFlag: resp.volatilityFlag || 0,
    uncertaintyEntropy: resp.uncertaintyEntropy ?? resp.volatilityFlag ?? 0,
    realizedVolatility: resp.realizedVolatility ?? null,
    signalMode: resp.signalMode ?? resp.metadata?.signalMode ?? null,
    sentimentType: resp.sentimentType || "neutral",
    suggestionType: resp.suggestionType || "hold",
    confidence: resp.confidence || 0,
    
    // Lý do & Nguồn
    rationaleSummary: resp.rationaleSummary || "",
    reasoning: resp.rationaleSummary || "", // Giữ lại để schema cũ không lỗi
    sources: resp.sources || [],        
    relatedTweetIds: resp.relatedTweetIds || [],

    metadata: resp.metadata ?? {
      type: "quant_v3_aggregation",
    },
  };

  return insert;
}

/**
 * Lưu tín hiệu vào MongoDB
 */
export async function saveSignalToDb(resp: any) {
  resp.signalDetected = true; 

  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    console.warn("[Persistence] MONGODB_URI not set; skipping persistence");
    return null;
  }
  // @ts-ignore
  const shared = await import("@gr2/shared");
  const { connectToDatabase, signalsTable, logProcessing, logSuccess, logFailed } = shared as any;

  try {
    await connectToDatabase();
    const insertData = mapQuantToMongoInsert(resp);

    await logProcessing(
      "Signal-Detector",
      `Saving QUANT V3 signal for ${insertData.tokenSymbol}...`,
      { tokenAddress: insertData.tokenAddress }
    );

    const created = await signalsTable.create(insertData);

    await logSuccess(
      "Signal-Detector",
      `Saved Signal V3: ${insertData.tokenSymbol} | Alpha: ${insertData.quantScore.toFixed(2)}`,
      { 
        signalId: created._id,
        tokenAddress: insertData.tokenAddress
      }
    );

    return created;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Persistence] DB Save Error:", errorMessage);
    throw error;
  }
}
