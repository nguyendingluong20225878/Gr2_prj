export { layer3Graph } from "./agent.js";
export type { ProposalState } from "./state.js";
export {
  enrichSignalSources,
  processSignal,
  runLayer3Batch,
  toProposalState,
} from "./workflow.js";
export type { Layer3WorkflowOptions } from "./workflow.js";

/**
 * Backwards compatibility wrapper for legacy test code.
 * Returns the compiled graph and an empty config object.
 */
export async function initProposalGeneratorGraph(signalId: string, userId: string) {
  const { layer3Graph } = await import("./agent.js");
  return {
    graph: layer3Graph,
    config: {},
  };
}
