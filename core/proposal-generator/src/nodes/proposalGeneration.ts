import { LangGraphRunnableConfig } from "@langchain/langgraph";
// Import hàm tạo prompt vừa viết
import { parser, generateProposalPromptText } from "../prompts/proposalGeneration";
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

  // 1. Kiểm tra dữ liệu đầu vào
  if (!signal || !user || !tokenPrices || !userBalance) {
    throw new Error("Required data missing in state.");
  }

  if (!modelInstance) throw new Error("AI Model not configured.");

  // 2. Tạo Prompt (Gọi hàm từ file prompts)
  const inputText = generateProposalPromptText({
    signal,
    tokenPrices,
    userBalance,
    latestTweets
  });

  // 3. Gọi Model
  console.log(`[Proposal Gen] Generating proposal for ${signal.tokenAddress}...`);
  const response = await modelInstance.invoke(inputText);
  
  // 4. Parse kết quả
  // KHÔNG CẦN try/catch xử lý markdown ở đây nữa vì parser đã làm rồi
  const result = await parser.invoke(response);

  if (!result || !result.proposal) {
    throw new Error("Failed to generate a valid proposal object.");
  }

  // 5. Gắn Metadata & Hoàn thiện
  const finalProposal = {
    ...result.proposal,
    userId,
    triggerEventId: signal._id || signalId,
    tokenAddress: signal.tokenAddress,
    status: "pending",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  };

  return {
    proposal: finalProposal,
  };
};