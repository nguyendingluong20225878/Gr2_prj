export const generateProposalPromptText = (data: {
  signal: any;
  tokenPrices: any;
  userBalance: any;
  latestTweets: any;
  tokenDetail: any; // Nhận thêm từ state
}) => {
  const { signal, tokenDetail, userBalance } = data;

  return `
    You are a Senior Crypto Portfolio Manager.
    ### 1. TARGET ASSET
    - Full Name: ${tokenDetail.name}
    - Symbol: ${tokenDetail.symbol}
    
    ### 2. THE SIGNAL
    - Action: ${signal.suggestionType.toUpperCase()}
    - Core Analysis: "${signal.rationaleSummary || signal.reasoning}"
    - Confidence: ${(signal.confidence * 100).toFixed(0)}%

    ### 3. USER BALANCE
    - Current Holdings: ${userBalance.balance} ${tokenDetail.symbol}
    - Portfolio Value: $${userBalance.totalAssetUsd}
    
    ### TASK:
    Generate a JSON object with key "proposal".
    - title: "Initiate Position: ${tokenDetail.name} (${tokenDetail.symbol})" (if balance is 0).
    - If user holds 0 balance, currentValue and projectedValue MUST be 0.
    
    OUTPUT RAW JSON ONLY.
  `;
};

// Giữ nguyên logic parser của bạn
export const parser: any = {
  name: "proposalParser",
  parse: async (input: any) => {
    let str = typeof input === "string" ? input : input?.content || JSON.stringify(input);
    str = str.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(str);
    } catch (e) {
      const m = str.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error("JSON Parse failed");
    }
  }
};