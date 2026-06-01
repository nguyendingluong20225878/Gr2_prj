import { proposalsTable } from '@gr2/shared';
import type { Proposal as SharedProposal } from '@gr2/shared';

// Compatibility adapter: web routes keep importing the default Proposal model,
// while the schema/model source of truth lives in core/shared.
const Proposal = proposalsTable;

export default Proposal;
export type ProposalSchema = SharedProposal;
export type Proposal = SharedProposal & { _id: string };
