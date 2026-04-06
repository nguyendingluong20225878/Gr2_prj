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
    throw new Error("AI Model not configured. GOOGLE_API_KEY_PROPOSAL missing.");
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
    // Sanitize projectedValue in response before parsing
    let content = response.content as string;
    // Attempt to fix projectedValue if it's a string with excessive zeros
    content = content.replace(/("projectedValue"\s*:\s*)([0-9]+\.[0-9]{6,})[0]+/g, (match, p1, p2) => {
      // Limit to 6 decimals
      return p1 + parseFloat(p2).toFixed(6);
    });
    result = await parser.parse(content);
  } catch (err) {
    console.error("[Proposal Gen] Error parsing AI response:", err);
    throw err;
  }

  // Fix lỗi kiểu unknown
  const aiProposal: any = result;

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
    // Always use sources from signal, preserve all
    sources: Array.isArray(signal.sources) ? signal.sources : [],
    type: aiProposal.type || signal.suggestionType || "trade",
    proposedBy: "NDL AI",
    financialImpact: {
      currentValue: currentVal,
      projectedValue: projectedVal,
      riskLevel: aiProposal.financialImpact?.riskLevel || "Medium",
      roi: calculatedRoi
    },
    // Normalize confidence to 0-100
    confidence: typeof aiProposal.confidence === 'number' ? Math.max(0, Math.min(100, aiProposal.confidence * (aiProposal.confidence <= 1 ? 100 : 1))) : (signal.confidence || 50),
    status: "pending",
    userId,
    triggerEventId: signal._id || signalId,
    tokenAddress: signal.tokenAddress || tokenDetail?.address || "unknown",
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: signal.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };

  console.log(`[Proposal Gen] ✅ Created: ${finalProposal.title} | ROI: ${calculatedRoi}%`);

  return {
    proposal: finalProposal,
  };
};