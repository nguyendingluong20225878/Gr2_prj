import { PromptTemplate } from "@langchain/core/prompts";
import type { KnownTokenType } from "./types";

export function buildKnownTokensBlock(knownTokens: KnownTokenType[]): string {
  if (!knownTokens || knownTokens.length === 0) {
    return "No specific tokens are pre-identified; analyze for any relevant crypto signals.";
  }
  // Chỉ lấy các trường cần thiết để tiết kiệm token
  const tokensJson = JSON.stringify(
    knownTokens.map(({ symbol, name, address }) => ({ symbol, name, address })),
    null,
    2,
  );
  return `Only analyze signals for the following known tokens:
  ${tokensJson}
  `;
}

// Template mới theo tư duy "Aggregation" (Gộp nhóm)
export const signalPromptTemplate = new PromptTemplate({
  template: `
You are a Senior Crypto Hedge Fund Analyst.
Your specialty is "Sentiment Aggregation" and "News-based Trading".

INPUT DATA:
1. KNOWN TOKENS (Whitelist):
{knownTokensBlock}

2. RECENT TWEETS (Raw Data):
{formattedTweets}

YOUR MISSION:
Analyze the tweets to find trading signals for the Known Tokens by AGGREGATING information.

PROCESS (Step-by-Step):

1. **GROUPING**: 
   - Scan all tweets and group them by the Token they mention.
   - Example: Gather all tweets mentioning "SOL" or "Solana" into one cluster.
   - Ignore tweets regarding tokens NOT in the Known List.

2. **AGGREGATION & ANALYSIS** (For each token cluster):
   - **Consensus Check**: Do most tweets agree? (e.g. 3 tweets say Buy, 0 say Sell -> High Confidence).
   - **Conflict Resolution**: If one tweet says "Buy" and another says "Sell":
     - Prioritize tweets from influential authors (if discernable) or breaking news over random opinions.
     - If the conflict is unresolved, set Action to "HOLD" or lower the Confidence score.
   - **Noise Filtering**: Ignore spam or vague tweets like "SOL into the moon" without context.

3. **SIGNAL GENERATION**:
   - Create ONE signal object per Token (if there is relevant info).
   - The "reason" field must summarize ALL tweets used for that token.
   - The "relatedTweetIds" must include IDs of all tweets used in the analysis for that token.

RESPONSE FORMAT:
{formatInstructions}

IMPORTANT:
- Output ONLY the raw JSON based on the format instructions above.
- Do not add markdown blocks or extra text.
`,
  // Lưu ý: formatInstructions được LangChain tự động điền vào
  inputVariables: ["formattedTweets", "knownTokensBlock", "formatInstructions"],
});