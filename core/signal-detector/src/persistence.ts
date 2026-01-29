import { LlmSignalResponse } from "./types"; 

/**
 * Map dữ liệu từ phản hồi của LLM (LlmSignalResponse) sang cấu trúc Document của MongoDB
 * Fixes:
 * - Map 'reason' -> 'rationaleSummary' (Schema Shared yêu cầu)
 * - Map 'reason' -> 'reasoning' (Schema Local yêu cầu - giữ cả 2 cho an toàn)
 * - Thêm strength, sentimentScore
 */
export function mapLlmResponseToSignalInsert(resp: any) {
  const detectedAt = new Date();

  // 1. Map Suggestion Type & Sentiment Type
  const rawAction = resp.action ? resp.action.toUpperCase() : "HOLD";
  
  let suggestionType = "hold";
  let sentimentType: "positive" | "negative" | "neutral" = "neutral";
  let sentimentScore = 0;

  if (rawAction === "BUY") {
    suggestionType = "buy";
    sentimentType = "positive";
    sentimentScore = 0.8; 
  } else if (rawAction === "SELL") {
    suggestionType = "sell";
    sentimentType = "negative";
    sentimentScore = -0.8; 
  }

  // 2. Xử lý Confidence & Strength
  // AI trả về resp.confidence là số từ 0 đến 100
  const aiConfidence = typeof resp.confidence === 'number' ? resp.confidence : 0;

  // Strength: Schema yêu cầu 1-100
  const strength = aiConfidence; 

  // Confidence: Schema thường dùng 0.0 - 1.0
  const confidence = aiConfidence > 1 ? aiConfidence / 100 : aiConfidence;

  // 3. Map Sources & Reason
  // Lấy lý do từ AI
  const rawReason = (resp.reason || "").slice(0, 5000); 
  
  // Tạo sources từ relatedTweetIds
  const relatedTweetIds = Array.isArray(resp.relatedTweetIds) ? resp.relatedTweetIds : [];
  const sources = relatedTweetIds.map((id: string) => ({
      label: "Twitter/X",
      url: `https://x.com/i/web/status/${id}`
  }));

  const expiresAt = new Date(detectedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 4. Object Insert 
  const insert = {
    // Các trường định danh
    tokenAddress: resp.tokenAddress || "unknown_address", 
    signalDetected: true,
    detectedAt,
    expiresAt,

    // Các trường dữ liệu phân tích
    suggestionType, 
    sentimentType,  
    sentimentScore, 
    
    strength,       
    confidence,     
    
    // === FIX QUAN TRỌNG TẠI ĐÂY ===
    // Schema Shared đòi 'rationaleSummary', Schema Local đòi 'reasoning'
    // Ta truyền cả 2 để tương thích mọi phiên bản DB
    reasoning: rawReason,
    rationaleSummary: rawReason, 
    // ==============================

    reasonInvalid: null,

    // Nguồn dữ liệu
    sources,        
    relatedTweetIds,

    // Metadata
    metadata: {
        tweetCount: resp.tweetCount,
        tokenSymbol: resp.tokenSymbol,
        type: resp.type || "social_aggregation"
    }
  };

  return insert;
}

/**
 * Lưu tín hiệu vào MongoDB
 */
export async function saveSignalToDb(resp: any) {
  if (!resp.signalDetected) return null;

  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    console.warn("[Persistence] MONGODB_URI not set; skipping persistence");
    return null;
  }
  
  // Dynamic Import Shared Module
  const shared = await import("../../shared/src/index.js");
  const { connectToDatabase, signalsTable, logProcessing, logSuccess, logFailed } = shared as any;

  try {
    await connectToDatabase();

    const insertData = mapLlmResponseToSignalInsert(resp);

    await logProcessing(
      "Signal-Detector",
      `Saving ${insertData.suggestionType.toUpperCase()} signal for ${resp.tokenSymbol}...`,
      { tokenAddress: insertData.tokenAddress }
    );

    // === ANTI-SPAM: Chặn trùng lặp trong 1 tiếng ===
    const DUPLICATE_WINDOW_MS = 60 * 60 * 1000; 
    const oneHourAgo = new Date(Date.now() - DUPLICATE_WINDOW_MS);
    
    const existingSignal = await signalsTable.findOne({
        tokenAddress: insertData.tokenAddress,
        suggestionType: insertData.suggestionType,
        createdAt: { $gte: oneHourAgo }
    });

    if (existingSignal) {
        console.log(`[Persistence] ⚠️ Skip duplicate signal for ${resp.tokenSymbol}`);
        return existingSignal; 
    }

    // Insert
    const created = await signalsTable.create(insertData);

    await logSuccess(
      "Signal-Detector",
      `Saved Signal: ${insertData.suggestionType.toUpperCase()} ${resp.tokenSymbol}`,
      { 
        signalId: created._id,
        tokenAddress: insertData.tokenAddress
      }
    );

    return created;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Persistence] DB Save Error:", errorMessage);
    
    try {
        await logFailed(
            "Signal-Detector",
            `Failed to save signal: ${errorMessage}`,
            { tokenAddress: resp.tokenAddress }
        );
    } catch (e) { /* Ignore */ }

    throw error;
  }
}