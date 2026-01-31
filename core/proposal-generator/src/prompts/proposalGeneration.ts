import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

// --- 1. Định nghĩa Schema Output ---
const proposalSchema = z.object({
  title: z.string().describe("A professional financial title"),
  summary: z.string().describe("Concise executive summary (2-3 sentences)"),
  reasons: z.array(z.string()).describe("3-5 bullet points explaining the logic"),
  type: z.enum(["buy", "sell", "hold", "stake", "close_position"]).describe("Action type"),
  confidence: z.number().min(0).max(100).describe("Confidence score (0-100)"),
  
  financialImpact: z.object({
    currentValue: z.number().describe("Must use the EXACT 'Current Portfolio Value' provided in context"),
    projectedValue: z.number().describe("Estimated value after action (e.g. +10% if buy)"),
    riskLevel: z.enum(["Low", "Medium", "High"]).describe("Risk assessment")
  }),
  
  sources: z.array(z.object({
    name: z.string(),
    url: z.string()
  })).optional()
});

export const parser = StructuredOutputParser.fromZodSchema(proposalSchema);

// --- 2. Helper tính giá (Xử lý String -> Number) ---
function calculateFinancials(tokenSymbol: string, tokenAddress: string, prices: any[], userBalanceObj: any) {
  // A. Lấy giá (Price)
  let price = 0;
  if (prices && prices.length > 0) {
    // Tìm giá khớp address
    const priceRecord = prices.find((p: any) => p.tokenAddress === tokenAddress);
    if (priceRecord && priceRecord.priceUsd) {
      price = parseFloat(priceRecord.priceUsd); // "168.48" -> 168.48
    }
  }

  // B. Lấy số dư (Balance)
  let balance = 0;
  if (userBalanceObj && userBalanceObj.balance) {
    balance = parseFloat(userBalanceObj.balance); // "15" -> 15.0
  }

  // C. Tính Current Value
  const currentValue = balance * price;

  return { price, balance, currentValue };
}

// --- 3. Tạo Prompt ---
export const generateProposalPromptText = (data: {
  signal: any;
  tokenPrices: any[];
  userBalance: any; // Object từ dataFetch
  latestTweets: any[];
  tokenDetail: any;
}) => {
  const { signal, tokenPrices, userBalance, latestTweets, tokenDetail } = data;
  const formatInstructions = parser.getFormatInstructions();

  const symbol = tokenDetail?.symbol || "TOKEN";
  const address = tokenDetail?.address || signal.tokenAddress;

  // === TÍNH TOÁN SỐ LIỆU TẠI ĐÂY ===
  const { price, balance, currentValue } = calculateFinancials(symbol, address, tokenPrices, userBalance);

  // Format hiển thị
  const fmtPrice = price > 0 ? `$${price.toFixed(4)}` : "Unknown Price";
  const fmtValue = currentValue > 0 ? `$${currentValue.toFixed(2)}` : "$0.00";
  
  // Context Tweets
  const tweetsContext = latestTweets.map(t => 
    `- [${new Date(t.tweetTime).toLocaleDateString()}] ${t.content.substring(0, 100)}...`
  ).join("\n");

  return `
You are a crypto portfolio manager AI. Generate a trading proposal based on this data.

=== 1. SIGNAL INFO ===
- Token: ${symbol}
- Action: ${signal.suggestionType?.toUpperCase()} (Confidence: ${signal.confidence}%)
- Rationale: ${signal.rationaleSummary}

=== 2. FINANCIAL DATA (STRICT) ===
Use these EXACT calculated numbers. Do not calculate them yourself.
- Token Price: ${fmtPrice}
- User Balance: ${balance} ${symbol}
- **Current Portfolio Value: ${currentValue}** (This is 'currentValue' in financialImpact)

=== 3. SOCIAL SENTIMENT ===
${tweetsContext}

=== 4. INSTRUCTIONS ===
1. **Financial Impact**:
   - 'currentValue': MUST be ${currentValue}.
   - 'projectedValue': Estimate a target based on the signal. 
     * If BUY/HOLD: Project a reasonable increase (e.g. +5% to +20%).
     * If SELL: Project the cash value retrieved (approx ${currentValue}).
     * **NEVER return 0** for projectedValue unless currentValue is 0.

2. **Analysis**: Combine signal rationale and social sentiment.

${formatInstructions}
`;
};