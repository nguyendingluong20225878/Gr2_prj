import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { parser, generateProposalPromptText } from "../prompts/proposalGeneration";
import { getProposalChatModel } from "../utils/model";
import { proposalGeneratorState } from "../utils/state";

// Khởi tạo model (sẽ dùng Gemini Direct API đã viết ở model.ts)
const modelInstance = getProposalChatModel();

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

  if (!modelInstance) {
    throw new Error("AI Model not configured. Please check GOOGLE_API_KEY.");
  }

  // 2. Tạo Prompt Text
  const inputText = generateProposalPromptText({
    signal,
    tokenPrices,
    userBalance,
    latestTweets
  });

  // 3. Gọi Model
  console.log(`[Proposal Gen] Generating proposal for ${signal.tokenSymbol || "Unknown"}...`);
  const response = await modelInstance.invoke(inputText);
  
  // 4. Parse kết quả với xử lý lỗi mạnh mẽ
  let result;
  try {
    // Dùng hàm .parse mới viết ở file prompt
    result = await parser.parse(response.content);
  } catch (err) {
    console.error("[Proposal Gen] Error parsing AI response.");
    throw err;
  }

  if (!result || !result.proposal) {
    throw new Error("AI returned a response but 'proposal' key is missing.");
  }

  // 5. Chuẩn hóa dữ liệu (Data Normalization)
  // Đảm bảo các giá trị tài chính là Number để tránh lỗi Schema DB
  const proposal = result.proposal;
  if (proposal.financialImpact) {
    proposal.financialImpact.currentValue = Number(proposal.financialImpact.currentValue) || 0;
    proposal.financialImpact.projectedValue = Number(proposal.financialImpact.projectedValue) || 0;
    proposal.financialImpact.percentChange = Number(proposal.financialImpact.percentChange) || 0;
  }

  // Đảm bảo confidence là số từ 0.0 - 1.0
  if (proposal.confidence > 1) proposal.confidence = proposal.confidence / 100;

  // 6. Gắn Metadata & Hoàn thiện
  const finalProposal = {
    ...proposal,
    userId,
    triggerEventId: signal._id || signalId,
    tokenAddress: signal.tokenAddress,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Hết hạn sau 24h
  };

  console.log(`[Proposal Gen] ✅ Success! Created title: ${finalProposal.title}`);

  return {
    proposal: finalProposal,
  };
};