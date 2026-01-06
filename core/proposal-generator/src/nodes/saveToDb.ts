import { proposalGeneratorState } from "../utils/state";
import { saveProposalToDb } from "../utils/db";
import { connectToDatabase, logProcessing, logSuccess, logFailed } from "../../../shared/dist";

export const saveToDbNode = async (
  state: typeof proposalGeneratorState.State,
) => {
  const proposal = state.proposal;

  if (!proposal) {
    console.error("[SaveToDB] No proposal found in state to save.");
    return {};
  }

  try {
    await connectToDatabase();
    
    console.log(`[SaveToDB] Saving proposal: "${proposal.title}" to MongoDB...`);
    
    await logProcessing(
      "Proposal-Generator",
      `Saving proposal "${proposal.title}"...`,
      { proposalTitle: proposal.title, type: proposal.type }
    );
    
    // Gọi hàm lưu đã định nghĩa trong db.ts
    const savedProposal = await saveProposalToDb(proposal);
    
    console.log(`[SaveToDB] Successfully saved proposal with ID: ${savedProposal._id}`);

    await logSuccess(
      "Proposal-Generator",
      `Successfully saved proposal "${proposal.title}" with ID ${savedProposal._id}`,
      { proposalId: savedProposal._id, title: proposal.title }
    );

    return {
      // Trả về object đã được lưu thành công
      proposal: savedProposal.toObject()
    };
  } catch (error: unknown) {
    // SỬA LỖI ts(18046): Kiểm tra nếu error là instance của Error trước khi lấy .message
    let errorMessage = "An unknown error occurred";
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    console.error("[SaveToDB] Error saving proposal:", errorMessage);
    
    await logFailed(
      "Proposal-Generator",
      `Failed to save proposal "${proposal.title}": ${errorMessage}`,
      { proposalTitle: proposal.title, error: errorMessage }
    );
    
    // Ném lỗi để LangGraph nhận diện bước này thất bại
    throw new Error(`SaveToDbNode failed: ${errorMessage}`);
  }
};