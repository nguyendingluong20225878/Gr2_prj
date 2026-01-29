import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { parser, generateProposalPromptText } from "../prompts/proposalGeneration";
import { getProposalChatModel } from "../utils/model";
import { proposalGeneratorState } from "../utils/state";

// Khởi tạo model (Gemini qua REST API)
const modelInstance = getProposalChatModel();

export const proposalGenerationNode = async (
  state: typeof proposalGeneratorState.State,
  options: LangGraphRunnableConfig,
) => {
  const userId = options.configurable?.userId;
  const signalId = options.configurable?.signalId;

  // === FIX LỖI 'UNKNOWN' TẠI ĐÂY ===
  // Ép kiểu signal sang any để TypeScript không báo lỗi khi truy cập ._id
  const signal = state.signal as any;
  const { user, tokenPrices, latestTweets, userBalance, tokenDetail } = state;

  // 1. Kiểm tra dữ liệu đầu vào
  if (!signal || !user || !tokenPrices || !userBalance) {
    throw new Error("Required data missing in state.");
  }

  if (!modelInstance) {
    throw new Error("AI Model not configured. Please check GOOGLE_API_KEY.");
  }

  // 2. Tạo Prompt Text (đã bao gồm thông tin TokenDetail)
  const inputText = generateProposalPromptText({
    signal,
    tokenPrices,
    userBalance,
    latestTweets,
    tokenDetail
  });

  // 3. Gọi Model Gemini
  console.log(`[Proposal Gen] Generating proposal for ${tokenDetail?.symbol || "Unknown"}...`);
  const response = await modelInstance.invoke(inputText);
  
  // 4. Parse kết quả JSON
  let result;
  try {
    // Dùng hàm .parse mạnh mẽ đã viết ở prompts/proposalGeneration.ts
    result = await parser.parse(response.content);
  } catch (err) {
    console.error("[Proposal Gen] Error parsing AI response.");
    throw err;
  }

  if (!result || !result.proposal) {
    throw new Error("AI returned a response but 'proposal' key is missing.");
  }

  // 5. Chuẩn hóa dữ liệu tài chính
  const proposal = result.proposal;
  if (proposal.financialImpact) {
    proposal.financialImpact.currentValue = Number(proposal.financialImpact.currentValue) || 0;
    proposal.financialImpact.projectedValue = Number(proposal.financialImpact.projectedValue) || 0;
    proposal.financialImpact.percentChange = Number(proposal.financialImpact.percentChange) || 0;
  }

  // Chuẩn hóa confidence về 0.0 - 1.0
  if (proposal.confidence > 1) proposal.confidence = proposal.confidence / 100;

  // 6. Gắn Metadata & Hoàn thiện object để lưu DB
  const finalProposal = {
    ...proposal,
    userId,
    // Truy cập _id không còn bị lỗi unknown
    triggerEventId: signal._id || signalId,
    tokenAddress: signal.tokenAddress,
    proposedBy: "NDL AI",
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  };

  console.log(`[Proposal Gen] ✅ Success! Created title: ${finalProposal.title}`);

  return {
    proposal: finalProposal,
  };
};