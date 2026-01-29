import { END, START, StateGraph } from "@langchain/langgraph";
import { proposalGeneratorState } from "./utils/state";
import { dataFetchNode } from "./nodes/dataFetch";
import { signalValidationNode } from "./nodes/signalValidation";
import { proposalGenerationNode } from "./nodes/proposalGeneration";
import { saveToDbNode } from "./nodes/saveToDb";

/**
 * 1. Hàm khởi tạo Workflow (createProposalWorkflow)
 * Dùng để script generateProposal.ts có thể gọi workflow.invoke()
 */
export function createProposalWorkflow() {
  const workflow = new StateGraph(proposalGeneratorState)
    .addNode("signalValidationNode", signalValidationNode)
    .addNode("dataFetchNode", dataFetchNode)
    .addNode("proposalGenerationNode", proposalGenerationNode)
    .addNode("saveToDbNode", saveToDbNode)

    .addEdge(START, "signalValidationNode")
    .addEdge("signalValidationNode", "dataFetchNode")
    .addEdge("dataFetchNode", "proposalGenerationNode")
    .addEdge("proposalGenerationNode", "saveToDbNode")
    .addEdge("saveToDbNode", END);

  // Biên dịch và trả về workflow
  return workflow.compile();
}

/**
 * 2. Hàm khởi tạo Graph cũ (initProposalGeneratorGraph)
 * Giữ lại để đảm bảo tính tương thích với các phần khác của dự án
 */
export async function initProposalGeneratorGraph(signalId: string, userId: string) {
  try {
    const config = { configurable: { signalId, userId } };
    const graph = createProposalWorkflow();
    
    return { graph, config };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}