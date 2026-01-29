/**
 * 1. Hàm tạo Prompt Text (Tối ưu cho Gemini JSON Mode)
 */
export const generateProposalPromptText = (data: {
  signal: any;
  tokenPrices: any;
  userBalance: any;
  latestTweets: any;
}) => {
  const { signal, tokenPrices, userBalance, latestTweets } = data;

  // Lấy lý do chính từ tín hiệu (tương thích cả rationaleSummary và reasoning)
  const coreAnalysis = signal.rationaleSummary || signal.reasoning || "No core analysis provided.";

  return `
    You are a Senior Crypto Portfolio Manager. 
    A high-confidence trading signal has been detected. Your job is to format it into a professional investment proposal.

    ### 1. THE SIGNAL (Primary Source of Truth)
    - Token: ${signal.tokenAddress}
    - Recommended Action: ${signal.suggestionType.toUpperCase()}
    - Confidence Level: ${(signal.confidence * 100).toFixed(0)}%
    - Core Analysis: "${coreAnalysis}"
    (NOTE: Use this 'Core Analysis' as the main foundation for your reasoning. Do not contradict it.)

    ### 2. FINANCIAL CONTEXT
    - Current Market Price Data: ${JSON.stringify(tokenPrices)}
    - User Holdings: ${JSON.stringify(userBalance)}
    
    ### 3. SUPPORTING EVIDENCE (Reference Only)
    - Raw Tweets: ${JSON.stringify(latestTweets)}

    ### TASK:
    Generate a JSON object with the EXACT structure below. 
    
    EXPECTED JSON STRUCTURE:
    {
      "proposal": {
        "title": "string",
        "summary": "string (2 sentences maximum)",
        "reason": ["string", "string", "string"], 
        "sources": [{"name": "string", "url": "string"}],
        "type": "trade" | "hold" | "opportunity",
        "confidence": number (float between 0.0 and 1.0),
        "financialImpact": {
          "currentValue": number,
          "projectedValue": number,
          "percentChange": number,
          "riskLevel": "Low" | "Medium" | "High"
        }
      }
    }

    IMPORTANT INSTRUCTIONS:
    1. The "reason" field MUST be an array of exactly 3 bullet points derived from the Core Analysis.
    2. "currentValue" should be a number (USD), not a string.
    3. If the user has 0 balance, currentValue is 0.
    4. Output ONLY the JSON object. Do not add markdown like \`\`\`json.
  `;
};

/**
 * 2. Parser (Đã tối ưu để bóc tách JSON cực mạnh)
 */
export const parser = {
  name: "proposalParser",
  parse: async (input: string | any) => {
    // Chuyển input về string
    let str = typeof input === "string" ? input : JSON.stringify(input);
    str = str.trim();

    // 1. Xóa Markdown nếu có
    if (str.includes("```")) {
      str = str.replace(/```json|```/g, "").trim();
    }

    // 2. Thử parse trực tiếp
    try {
      return JSON.parse(str);
    } catch (e) {
      // 3. Fallback: Tìm ngoặc nhọn { ... } đầu tiên và cuối cùng (Phòng trường hợp AI chat thêm)
      const firstBracket = str.indexOf('{');
      const lastBracket = str.lastIndexOf('}');
      
      if (firstBracket !== -1 && lastBracket !== -1) {
        const jsonOnly = str.substring(firstBracket, lastBracket + 1);
        try {
          return JSON.parse(jsonOnly);
        } catch (innerError) {
          console.error("[Parser Error] Could not parse extracted JSON block:", jsonOnly);
        }
      }
      
      console.error("[Parser Error] Model Output was not valid JSON:", str);
      throw new Error("proposal-parser: failed to parse model output as JSON");
    }
  },
};