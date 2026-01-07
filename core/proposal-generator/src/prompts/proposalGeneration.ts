import { HumanMessage } from "@langchain/core/messages";

// 1. Hàm tạo Prompt Text (Chuyển từ Node sang đây)
export const generateProposalPromptText = (data: {
  signal: any;
  tokenPrices: any;
  userBalance: any;
  latestTweets: any;
}) => {
  const { signal, tokenPrices, userBalance, latestTweets } = data;

  return `
    You are a Senior Crypto Portfolio Manager. 
    A high-confidence trading signal has been detected. Your job is to format it into a professional investment proposal for the user.

    ### 1. THE SIGNAL (Primary Source of Truth)
    - Token: ${signal.tokenAddress}
    - Recommended Action: ${signal.suggestionType.toUpperCase()}
    - Confidence Level: ${(signal.confidence * 100).toFixed(0)}%
    - Core Analysis: "${signal.rationaleSummary}" 
    (NOTE: Use this 'Core Analysis' as the main foundation for your reasoning. Do not contradict it.)

    ### 2. FINANCIAL CONTEXT
    - Current Market Price: ${JSON.stringify(tokenPrices)}
    - User Current Holdings: ${JSON.stringify(userBalance)}
    
    ### 3. SUPPORTING EVIDENCE (Reference Only)
    - Raw Tweets: ${JSON.stringify(latestTweets)}

    ### TASK:
    Generate a JSON object with the key "proposal" containing:
    - title: A catchy, professional title (e.g., "Strategic Entry for [Token] based on On-chain Data").
    - summary: A 2-sentence executive summary.
    - reason: An array of strings. Break down the 'Core Analysis' into 3 clear bullet points.
    - sources: Extract valid URLs from the tweets or signal metadata. Map to {name: "Source Name", url: "URL"}.
    - type: "trade" (if buy/sell) | "hold" | "opportunity".
    - financialImpact: 
        - currentValue: (User's current balance of this token in USD).
        - projectedValue: (Estimate a realistic target value based on the signal confidence. E.g., if Buy & High Confidence, project 5-10% increase).
        - riskLevel: "Low" | "Medium" | "High" (Derive this from the signal confidence: High Conf = Lower Risk).

    OUTPUT FORMAT:
    JSON only. Follow the structure strictly. Do not include markdown blocks.
  `;
};

// 2. Parser (Giữ nguyên logic tốt của bạn)
export const parser: any = {
  name: "proposalParser",
  invoke: async (output: any) => {
    // Lấy nội dung text
    const raw = output?.content ?? output?.text ?? (typeof output === "string" ? output : JSON.stringify(output));
    let str = String(raw).trim();

    // Clean Markdown (Logic này đã đủ tốt, không cần làm lại ở Node)
    if (str.includes("```")) {
      str = str.replace(/```json|```/g, "").trim();
    }

    try {
      return JSON.parse(str);
    } catch (e) {
      // Fallback: Tìm ngoặc nhọn nếu AI lỡ chat chit thêm
      const m = str.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          return JSON.parse(m[0]);
        } catch (_) {}
      }
      console.error("[Parser Error] Model Output was not valid JSON:", str);
      throw new Error("proposal parser: failed to parse model output as JSON");
    }
  },
};