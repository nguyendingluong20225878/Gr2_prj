import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { parser } from "../prompts/proposalGeneration";
import { getProposalChatModel } from "../utils/model";
import { proposalGeneratorState } from "../utils/state";

const modelInstance = getProposalChatModel("gpt-4o-mini");

export const proposalGenerationNode = async (
  state: typeof proposalGeneratorState.State,
  options: LangGraphRunnableConfig,
) => {
  const userId = options.configurable?.userId;
  const signalId = options.configurable?.signalId;

  const { signal, user, tokenPrices, latestTweets, userBalance } = state;

  // Kiểm tra dữ liệu đầu vào
  if (!signal || !user || !tokenPrices || !latestTweets || !userBalance) {
    throw new Error("Required data missing in state.");
  }

  // System Prompt yêu cầu JSON cụ thể
  const inputText = `
    You are a professional crypto investment assistant. 
    Based on the provided data, generate a trade proposal in JSON format.
    The JSON must have a "proposal" key containing:
    - title: string
    - summary: string
    - reason: string[]
    - sources: {name: string, url: string}[]
    - type: "trade" | "stake" | "risk" | "opportunity"
    - financialImpact: {currentValue: number, projectedValue: number, riskLevel: string}

    DATA:
    User: ${JSON.stringify(user)}
    Signal: ${JSON.stringify(signal)}
    Market: ${JSON.stringify(tokenPrices)}
    Social: ${JSON.stringify(latestTweets)}
    Balance: ${JSON.stringify(userBalance)}
  `;

  if (!modelInstance) throw new Error("AI Model not configured.");

  // Gọi Model và Parser
  const response = await modelInstance.invoke(inputText);
  const result = await parser.invoke(response);

  if (!result || !result.proposal) {
    throw new Error("Failed to generate a valid proposal object.");
  }

  // Gắn thêm metadata vào proposal
  const finalProposal = {
    ...result.proposal,
    userId,
    triggerEventId: signal._id || signalId,
    status: "pending",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Hết hạn sau 24h
  };

  return {
    proposal: finalProposal,
  };
};