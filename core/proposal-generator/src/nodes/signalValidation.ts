import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { fetchSignal } from "../utils/db";
import { proposalGeneratorState } from "../utils/state";

export const signalValidationNode = async (
  state: typeof proposalGeneratorState.State,
  options: LangGraphRunnableConfig,
) => {
  const signalId = options.configurable?.signalId;
  
  if (!signalId) {
    throw new Error("signal_id is missing in config");
  }

  console.log(`[Signal Validation] Validating signal: ${signalId}`);

  // 1. Ép kiểu 'any' hoặc kiểu dữ liệu Signal của bạn để vượt qua kiểm tra TS
  const signal = (await fetchSignal(signalId)) as any;

  if (!signal) {
    console.error(`[Signal Validation] Signal not found: ${signalId}`);
    throw new Error(`Signal not found: ${signalId}`);
  }

  // 2. Kiểm tra thuộc tính bằng cách sử dụng ngoặc vuông nếu TS vẫn báo lỗi
  // Hoặc dùng Optional Chaining và ép kiểu Date
  const createdAtValue = signal.createdAt || signal.created_at; 
  
  if (!createdAtValue) {
    console.warn(`[Signal Validation] Signal ${signalId} does not have a timestamp`);
    // Nếu không có timestamp thì có thể bỏ qua check tuổi hoặc gán mặc định
    return { signal };
  }

  const signalAge = Date.now() - new Date(createdAtValue).getTime();
  const maxAge = 24 * 60 * 60 * 1000;

  if (signalAge > maxAge) {
    console.warn(`[Signal Validation] Signal is too old: ${signalId}`);
    throw new Error(`Signal is too old: ${signalId}`);
  }

  console.log(`[Signal Validation] Signal validated successfully: ${signalId}`);

  return {
    signal,
  };
};