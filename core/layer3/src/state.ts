// layer3/src/state.ts
import { BaseMessage } from "@langchain/core/messages";

export interface ProposalState {
  signalId: string;
  tokenSymbol: string;
  quantScore: number;
  confidence: number;
  suggestionType: string;
  sourcesContent: string;
  rationaleSummary?: string;
  messages: BaseMessage[];
}