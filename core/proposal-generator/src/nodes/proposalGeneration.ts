import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { parser, generateProposalPromptText } from "../prompts/proposalGeneration";
import { getProposalChatModel } from "../utils/model";
import { proposalGeneratorState } from "../utils/state";

export const proposalGenerationNode = async (
  state: typeof proposalGeneratorState.State,
  options: LangGraphRunnableConfig,
) => {
  const userId = options.configurable?.userId;
  const signalId = options.configurable?.signalId;

  const modelInstance = getProposalChatModel();
  if (!modelInstance) {
    throw new Error("AI Model not configured. GOOGLE_API_KEY missing.");
  }

  const signal = state.signal as any;
  const { user, tokenPrices, latestTweets, userBalance, tokenDetail } = state;

  if (!signal || !user) {
    throw new Error("Required data missing in state.");
  }

  // Tạo Prompt
  const inputText = generateProposalPromptText({
    signal,
    tokenPrices,
    userBalance,
    latestTweets,
    tokenDetail
  });

  console.log(`[Proposal Gen] Generating proposal for ${tokenDetail?.symbol || "Token"}...`);
  
  const response = await modelInstance.invoke(inputText);
  
  let result;
  try {
    result = await parser.parse(response.content as string);
  } catch (err) {
    console.error("[Proposal Gen] Error parsing AI response:", err);
    throw err;
  }

  const aiProposal = result; 

  // === TÍNH TOÁN ROI (LOGIC MỚI) ===
  const currentVal = Number(aiProposal.financialImpact?.currentValue) || 0;
  const projectedVal = Number(aiProposal.financialImpact?.projectedValue) || 0;
  
  let calculatedRoi = 0;
  if (currentVal > 0) {
      // Công thức: ((Giá dự kiến - Giá hiện tại) / Giá hiện tại) * 100
      calculatedRoi = ((projectedVal - currentVal) / currentVal) * 100;
  }
  
  // Làm tròn 2 chữ số thập phân
  calculatedRoi = parseFloat(calculatedRoi.toFixed(2));

  const finalProposal = {
    title: aiProposal.title,
    summary: aiProposal.summary,
    
    reason: Array.isArray(aiProposal.reasons) ? aiProposal.reasons : [signal.rationaleSummary],
    
    sources: (aiProposal.sources && aiProposal.sources.length > 0) ? aiProposal.sources : signal.sources || [],
    type: aiProposal.type || signal.suggestionType || "trade",
    proposedBy: "NDL AI",
    
    financialImpact: {
      currentValue: currentVal,
      projectedValue: projectedVal,
      riskLevel: aiProposal.financialImpact?.riskLevel || "Medium",
      roi: calculatedRoi // <--- LƯU ROI VÀO DB
    },
    
    confidence: aiProposal.confidence || signal.confidence,
    status: "pending",
    
    userId,
    triggerEventId: signal._id || signalId,
    tokenAddress: signal.tokenAddress,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: signal.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };

  console.log(`[Proposal Gen] ✅ Created: ${finalProposal.title} | ROI: ${calculatedRoi}%`);

  return {
    proposal: finalProposal,
  };
};