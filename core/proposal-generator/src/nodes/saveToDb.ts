import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { proposalGeneratorState } from "../utils/state";
import { saveProposalToDb } from "../utils/db";

export const saveToDbNode = async (
  state: typeof proposalGeneratorState.State,
  options: LangGraphRunnableConfig,
) => {
  const { proposal, signal } = state;
  const userId = options.configurable?.userId;

  if (!proposal) throw new Error("No proposal data to save");

  // Gom tất cả data để lưu vào MongoDB
  const dbData = {
    ...proposal,
    userId: userId,
    triggerEventId: (signal as any)?._id?.toString()
  };

  try {
    const saved = await saveProposalToDb(dbData);
    console.log(`[SaveToDB] Successfully saved proposal with ID: ${saved._id}`);
    return { proposal: saved };
  } catch (error: any) {
    console.error("[SaveToDB] Error saving proposal:", error.message);
    throw error;
  }
};