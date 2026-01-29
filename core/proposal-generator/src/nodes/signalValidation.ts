import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { fetchSignal } from "../utils/db"; // Import hàm cụ thể
import { proposalGeneratorState } from "../utils/state";

export const signalValidationNode = async (
  state: typeof proposalGeneratorState.State,
  options: LangGraphRunnableConfig,
) => {
  const signalId = options.configurable?.signalId;
  console.log(`[Signal Validation] Validating signal: ${signalId}`);

  // Gọi trực tiếp hàm đã được export cụ thể
  const signal = await fetchSignal(signalId);

  if (!signal) {
    throw new Error(`Signal với ID ${signalId} không tồn tại trong database.`);
  }

  return { signal };
};