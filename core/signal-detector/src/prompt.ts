import { PromptTemplate } from "@langchain/core/prompts";
import type { KnownTokenType } from "./types";


export function buildKnownTokensBlock(knownTokens: KnownTokenType[]): string {
  if (!knownTokens || knownTokens.length === 0) {
    return "No specific tokens are pre-identified; analyze for any relevant crypto signals.";
  }
  const tokensJson = JSON.stringify(
    knownTokens.map(({ symbol, name, address }) => ({ symbol, name, address })),
    null,
    2,
  );
  return `Only analyze signals for the following known tokens:

        START_KNOWN_TOKENS_BLOCK
         ${tokensJson}
        END_KNOWN_TOKENS_BLOCK`;

}

//Template
export const signalPromptTemplate = new PromptTemplate({
  template: `
You are a crypto market analyst.

Your job is simple:
Based ONLY on the tweets below, decide whether there is a clear and actionable signal
that could realistically affect the price of a crypto token.

Do not use outside knowledge.
Do not guess.
If the information is weak or unclear, return no signal.

--------------------
TWEETS (JSON):
{formattedTweets}
--------------------

{knownTokensBlock}

Rules:
- Analyze ONLY tokens listed in the known tokens block.
- Ignore tweets unrelated to those tokens.
- It is always better to return "no signal" than to make assumptions.

What counts as a strong signal:
1. Large or whale buy/sell activity.
2. Official announcements from the project or founders.
3. Major liquidity changes on well-known DEXs.
4. Reports from reputable crypto news sources.

How to judge:
- Ask: “Is this information likely to move price, not just sentiment?”
- Source credibility matters more than likes or retweets.
- Be conservative if details are missing.

Output:
Return exactly ONE JSON object following the schema below.

If a signal exists:
- Set signalDetected = true
- Identify the token (only if explicit)
- Explain briefly why this could impact price
- Estimate sentiment, strength, impact, and confidence

If no signal exists:
- Set signalDetected = false
- Briefly explain why the tweets are not strong enough

Required JSON schema:
{{
  "signalDetected": boolean,
  "tokenAddress": "string",
  "sources": [{{ "url": "string", "label": "string" }}],
  "sentimentScore": "number (-1.0 to 1.0)",
  "suggestionType": "buy | sell | hold | close_position | stake",
  "strength": "number (1-100 or null)",
  "confidence": "number (0.0-1.0 or null)",
  "reasoning": "string",
  "relatedTweetIds": ["string"],
  "reasonInvalid": "string (only if signalDetected is false)",
  "impactScore": "number (1-10 or null)"
}}

Output ONLY the raw JSON.
No markdown.
No extra text.
`,
  inputVariables: ["formattedTweets", "knownTokensBlock"],
});

