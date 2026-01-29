import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { parser, generateProposalPromptText } from "../prompts/proposalGeneration";
import { getProposalChatModel } from "../utils/model";
import { proposalGeneratorState } from "../utils/state";

// XÓA DÒNG NÀY: const modelInstance = getProposalChatModel();
// Vì gọi ở đây sẽ chạy trước khi .env được load

export const proposalGenerationNode = async (
  state: typeof proposalGeneratorState.State,
  options: LangGraphRunnableConfig,
) => {
  const userId = options.configurable?.userId;
  const signalId = options.configurable?.signalId;

  // === KHỞI TẠO MODEL TẠI ĐÂY (LAZY LOAD) ===
  // Lúc này dotenv trong script generateProposal.ts đã chạy xong, nên sẽ nhận được Key
  const modelInstance = getProposalChatModel();

  if (!modelInstance) {
    throw new Error("AI Model not configured. GOOGLE_API_KEY missing in .env");
  }

  // Ép kiểu signal sang any để TypeScript không báo lỗi khi truy cập ._id
  const signal = state.signal as any;
  const { user, tokenPrices, latestTweets, userBalance, tokenDetail } = state;

  // 1. Kiểm tra dữ liệu đầu vào
  if (!signal || !user) {
    throw new Error("Required data missing in state.");
  }

  // 2. Tạo Prompt Text
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
    result = await parser.parse(response.content);
  } catch (err) {
    console.error("[Proposal Gen] Error parsing AI response.");
    throw err;
  }

  if (!result || !result.proposal) {
    throw new Error("AI returned a response but 'proposal' key is missing.");
  }

  const aiProposal = result.proposal;

  // === CHUẨN HÓA DATA THEO MẪU YÊU CẦU ===
  const finalProposal = {
    title: aiProposal.title,
    summary: aiProposal.summary,
    
    // Đảm bảo reason luôn là mảng string
    reason: Array.isArray(aiProposal.reasons) ? aiProposal.reasons : 
            Array.isArray(aiProposal.reason) ? aiProposal.reason : 
            [signal.rationaleSummary].filter(Boolean),
            
    // Sources: Ưu tiên lấy từ AI, nếu không có thì lấy từ Signal gốc
    sources: (aiProposal.sources && aiProposal.sources.length > 0)
            ? aiProposal.sources
            : signal.sources?.map((s: any) => ({ name: s.label, url: s.url })) || [],
            
    type: aiProposal.type || signal.suggestionType || "trade",
    proposedBy: "NDL AI",
    
    financialImpact: {
      currentValue: Number(aiProposal.financialImpact?.currentValue) || 0,
      projectedValue: Number(aiProposal.financialImpact?.projectedValue) || 0,
      riskLevel: aiProposal.financialImpact?.riskLevel || "Medium"
    },
    
    confidence: aiProposal.confidence || signal.confidence,
    status: "pending",
    
    // Các trường Metadata
    userId,
    triggerEventId: signal._id || signalId,
    tokenAddress: signal.tokenAddress,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: signal.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };

  console.log(`[Proposal Gen] ✅ Success! Created title: ${finalProposal.title}`);

  return {
    proposal: finalProposal,
  };
};