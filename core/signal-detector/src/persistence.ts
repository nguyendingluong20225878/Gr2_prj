export function mapLlmResponseToSignalInsert(resp: any) {
  const detectedAt = new Date();

  // 1. Map Action (BUY/SELL) sang Sentiment (positive/negative)
  let sentimentType: "positive" | "negative" | "neutral" = "neutral";
  if (resp.action === "BUY") sentimentType = "positive";
  else if (resp.action === "SELL") sentimentType = "negative";

  // 2. Xử lý Confidence
  // AI trả về 0-100. Database (thường) lưu 0.0-1.0.
  let confidence = resp.confidence ?? 0;
  if (confidence > 1) {
    confidence = confidence / 100;
  }

  // 3. Map các trường khác
  // Schema mới dùng 'reason', schema cũ dùng 'rationaleSummary'
  const rationaleSummary = (resp.reason || "").slice(0, 2000);
  
  // Thời gian hết hạn signal (7 ngày)
  const expiresAt = new Date(detectedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 4. Chuẩn bị object để insert
  const insert = {
    tokenAddress: resp.tokenAddress,
    detectedAt,
    // Schema mới trả về relatedTweetIds thay vì sources {label, url}.
    // Ta để sources rỗng để tránh lỗi map(), hoặc có thể map ID thành link giả lập nếu muốn.
    sources: (resp.relatedTweetIds || []).map((id: string) => ({
        label: "Twitter/X",
        url: `https://x.com/i/web/status/${id}`
    })),
    sentimentType,
    // Chuyển BUY -> buy, SELL -> sell để đồng bộ convention
    suggestionType: resp.action ? resp.action.toLowerCase() : "hold",
    confidence,
    rationaleSummary,
    expiresAt,
    // Lưu thêm metadata nếu DB cho phép (optional)
    metadata: {
        tweetCount: resp.tweetCount,
        type: resp.type
    }
  };

  return insert;
}

// Nếu phát hiện tín hiệu, lưu vào DB MongoDB
export async function saveSignalToDb(resp: any) {
  // Kiểm tra điều kiện tiên quyết
  if (!resp.signalDetected) {
    return null;
  }

  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    console.warn("saveSignalToDb: MONGODB_URI not set; skipping persistence");
    return null;
  }
  
  // Import Dynamic từ Shared
  const shared = await import("../../shared/src/index.js");
  const { connectToDatabase, signalsTable, logProcessing, logSuccess, logFailed } = shared as any;

  try {
    await connectToDatabase();

    await logProcessing(
      "Signal-Detector",
      `Saving ${resp.action} signal for ${resp.tokenSymbol || resp.tokenAddress}...`,
      { tokenAddress: resp.tokenAddress }
    );

    const insert = mapLlmResponseToSignalInsert(resp);
    
    // Lưu vào DB
    const created = await signalsTable.create(insert);

    await logSuccess(
      "Signal-Detector",
      `Saved ${insert.suggestionType.toUpperCase()} signal for ${resp.tokenSymbol} (Conf: ${Math.round(insert.confidence * 100)}%)`,
      { 
        signalId: created._id,
        tokenAddress: resp.tokenAddress, 
        confidence: insert.confidence
      }
    );

    return created;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("DB Save Error:", errorMessage);
    
    // Thử log lỗi vào hệ thống (nếu có thể)
    try {
        await logFailed(
            "Signal-Detector",
            `Failed to save signal: ${errorMessage}`,
            { tokenAddress: resp.tokenAddress }
        );
    } catch (e) { /* Ignore log error */ }

    throw error;
  }
}