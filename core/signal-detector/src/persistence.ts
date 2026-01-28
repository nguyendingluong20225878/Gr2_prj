import { LlmSignalResponse } from "./types"; // Hoặc import type tương ứng

/**
 * Map dữ liệu từ phản hồi của LLM (LlmSignalResponse) sang cấu trúc Document của MongoDB
 * Fixes:
 * - Thêm strength (bắt buộc bởi Schema)
 * - Thêm sentimentScore (bắt buộc bởi Schema)
 * - Map đúng relatedTweetIds sang sources
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
    sentimentScore = 0.8; // Mặc định mức tích cực cao
  } else if (rawAction === "SELL") {
    suggestionType = "sell";
    sentimentType = "negative";
    sentimentScore = -0.8; // Mặc định mức tiêu cực cao
  }

  // 2. Xử lý Confidence & Strength
  // AI trả về resp.confidence là số từ 0 đến 100
  const aiConfidence = typeof resp.confidence === 'number' ? resp.confidence : 0;

  // Strength: Schema yêu cầu 1-100 (dùng cho hiển thị độ mạnh)
  const strength = aiConfidence; 

  // Confidence: Schema thường dùng 0.0 - 1.0 (dùng cho xác suất)
  // Nếu AI trả về > 1 (ví dụ 85), ta chia 100 -> 0.85
  const confidence = aiConfidence > 1 ? aiConfidence / 100 : aiConfidence;

  // 3. Map Sources & Reason
  // Schema dùng 'reasoning', input dùng 'reason'
  const reasoning = (resp.reason || "").slice(0, 5000); 
  
  // Tạo sources từ relatedTweetIds để thỏa mãn Schema required
  const relatedTweetIds = Array.isArray(resp.relatedTweetIds) ? resp.relatedTweetIds : [];
  const sources = relatedTweetIds.map((id: string) => ({
      label: "Twitter/X",
      url: `https://x.com/i/web/status/${id}`
  }));

  // Thời gian hết hạn signal (ví dụ: 7 ngày)
  const expiresAt = new Date(detectedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 4. Object Insert (Phải khớp với LlmSignalDocument trong schema.ts)
  const insert = {
    // Các trường định danh
    tokenAddress: resp.tokenAddress || "unknown_address", // Được gán từ run-detection
    signalDetected: true, // Hàm saveSignalToDb đã check true bên ngoài mới gọi vào đây
    detectedAt,
    expiresAt,

    // Các trường dữ liệu phân tích
    suggestionType, // "buy", "sell", "hold"
    sentimentType,  // "positive", "negative", "neutral"
    sentimentScore, // -1 đến 1
    
    strength,       // 1-100 (Fix lỗi schema validation)
    confidence,     // 0-1
    
    reasoning,      // Lý do chi tiết
    reasonInvalid: null,

    // Nguồn dữ liệu
    sources,        
    relatedTweetIds,

    // Metadata bổ sung (lưu vào mixed field nếu DB hỗ trợ, hoặc bỏ qua nếu strict schema)
    metadata: {
        tweetCount: resp.tweetCount,
        tokenSymbol: resp.tokenSymbol
    }
  };

  return insert;
}

/**
 * Lưu tín hiệu vào MongoDB
 * Có cơ chế Dynamic Import để dùng chung code với Shared module
 * Có cơ chế lọc trùng lặp trong thời gian ngắn
 */
export async function saveSignalToDb(resp: any) {
  // 1. Kiểm tra điều kiện tiên quyết
  if (!resp.signalDetected) {
    return null;
  }

  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    console.warn("[Persistence] MONGODB_URI not set; skipping persistence");
    return null;
  }
  
  // 2. Dynamic Import (Để tránh lỗi Circular Dependency hoặc chạy script độc lập)
  // Đường dẫn này phải đúng với cấu trúc thư mục của bạn
  const shared = await import("../../shared/src/index.js");
  const { connectToDatabase, signalsTable, logProcessing, logSuccess, logFailed } = shared as any;

  try {
    await connectToDatabase();

    // 3. Chuẩn bị dữ liệu
    const insertData = mapLlmResponseToSignalInsert(resp);

    await logProcessing(
      "Signal-Detector",
      `Saving ${insertData.suggestionType.toUpperCase()} signal for ${resp.tokenSymbol}...`,
      { tokenAddress: insertData.tokenAddress }
    );

    // 4. === LOGIC CHẶN TRÙNG LẶP (ANTI-SPAM) ===
    // Tìm xem đã có tín hiệu nào cho Token này, cùng loại lệnh (BUY/SELL), trong vòng 60 phút qua chưa?
    const DUPLICATE_WINDOW_MS = 60 * 60 * 1000; // 1 Tiếng
    const oneHourAgo = new Date(Date.now() - DUPLICATE_WINDOW_MS);
    
    const existingSignal = await signalsTable.findOne({
        tokenAddress: insertData.tokenAddress,
        suggestionType: insertData.suggestionType,
        createdAt: { $gte: oneHourAgo }
    });

    if (existingSignal) {
        console.log(`[Persistence] ⚠️ Skip duplicate signal for ${resp.tokenSymbol} (Created at ${existingSignal.createdAt.toISOString()})`);
        return existingSignal; // Trả về cái cũ, không tạo mới
    }

    // 5. Lưu vào DB
    const created = await signalsTable.create(insertData);

    await logSuccess(
      "Signal-Detector",
      `Saved Signal: ${insertData.suggestionType.toUpperCase()} ${resp.tokenSymbol} (Strength: ${insertData.strength})`,
      { 
        signalId: created._id,
        tokenAddress: insertData.tokenAddress, 
        confidence: insertData.confidence
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
    } catch (e) { /* Ignore log error */ }

    throw error;
  }
}