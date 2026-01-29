export const generateProposalPromptText = (data: {
  signal: any;
  tokenPrices: any;
  userBalance: any;
  latestTweets: any;
  tokenDetail: any;
}) => {
  const { signal, tokenDetail, userBalance, latestTweets } = data;

  // Lấy giá hiện tại để AI có context tính toán
  const currentPrice = data.tokenPrices?.[0]?.price || 0;

  return `
    You are a Senior Crypto Portfolio Manager.
    
    ### 1. TARGET ASSET
    - Name: ${tokenDetail.name} (${tokenDetail.symbol})
    - Current Price: $${currentPrice}
    
    ### 2. THE SIGNAL
    - Action: ${signal.suggestionType.toUpperCase()}
    - Analysis: "${signal.rationaleSummary || signal.reasoning}"
    - Signal Confidence: ${(signal.confidence * 100).toFixed(0)}%

    ### 3. USER CONTEXT
    - Holdings: ${userBalance.balance} ${tokenDetail.symbol}
    - Total Portfolio: $${userBalance.totalAssetUsd}
    - Recent News: ${latestTweets.map((t: any) => t.content).join(" | ").slice(0, 300)}...

    ### TASK:
    Generate a generic JSON object (key: "proposal") for a trading proposal.
    
    ### REQUIRED JSON STRUCTURE:
    {
      "proposal": {
        "title": "String (e.g., 'Initiate Position: Solana (SOL)')",
        "summary": "String (A concise executive summary of why this trade is recommended. REQUIRED.)",
        "reasons": ["String", "String", "String"],
        "confidence": Number (Float between 0.0 and 1.0, e.g., 0.85. DO NOT use strings or %),
        "type": "String (buy, sell, hold, or trade)",
        "financialImpact": {
          "currentValue": Number (User's current holding value in USD),
          "projectedValue": Number (Predicted value in 24h),
          "percentChange": Number (e.g., 5.2),
          "riskLevel": "String (Low, Medium, High)"
        }
      }
    }

    ### RULES:
    1. "summary" is MANDATORY. Write 2-3 sentences.
    2. "confidence" must be a number (e.g., 0.75), NOT a string like "75%".
    3. If user balance is 0, "currentValue" must be 0.
    
    OUTPUT RAW JSON ONLY. NO MARKDOWN.
  `;
};

export const parser: any = {
  name: "proposalParser",
  parse: async (input: any) => {
    let str = typeof input === "string" ? input : input?.content || JSON.stringify(input);
    // Làm sạch chuỗi JSON
    str = str.replace(/```json|```/g, "").trim();
    
    try {
      const parsed = JSON.parse(str);
      
      // Post-processing để sửa lỗi phổ biến của AI
      if (parsed.proposal) {
        // Fix lỗi confidence là string "75%"
        if (typeof parsed.proposal.confidence === 'string') {
          parsed.proposal.confidence = parseFloat(parsed.proposal.confidence.replace('%', '')) / 100;
        }
        // Fix lỗi confidence > 1 (vd: 85 -> 0.85)
        if (parsed.proposal.confidence > 1) {
          parsed.proposal.confidence = parsed.proposal.confidence / 100;
        }
      }
      
      return parsed;
    } catch (e) {
      // Fallback: Cố gắng trích xuất JSON từ text hỗn tạp
      const m = str.match(/\{[\s\S]*\}/);
      if (m) {
        try {
           return JSON.parse(m[0]);
        } catch (err) {}
      }
      throw new Error("JSON Parse failed: " + str.slice(0, 50) + "...");
    }
  }
};