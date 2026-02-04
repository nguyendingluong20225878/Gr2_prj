// ===== DB =====
export * from "./db/index.js";
export * from "./db/connection.js";

// ===== PROPOSALS =====
export { getProposalModel } from "./db/schema/proposals.js";
export type {
  Proposal,
  ProposalDocument,
  ProposalInsert,
} from "./db/schema/proposals.js";

// ===== X / TWEETS =====
export { tweetTable } from "./db/schema/tweets.js";
export { xAccountTable } from "./db/schema/x_accounts.js";

// ===== TYPES =====
export * from "./types/index.js";

// ===== UTILS =====
export { Logger, logger } from "./utils/logger.js";

export {
  createDbLog,
  logProcessing,
  logSuccess,
  logFailed,
} from "./utils/db-logging.js";

export type {
  DbLogEntry,
  DbLogStatus,
} from "./utils/db-logging.js";

// ===== REPOSITORIES =====
export type {
  XAccountRepository,
  TweetRepository,
} from "./repositories/interface/index.js";

// ===== CONSTANTS =====
export * from "./constants/index.js";

// ===== TOKENS =====
export { tokensTable } from "./db/schema/tokens.js";
export type { TokenDocument } from "./db/schema/tokens.js";

export { tokenPriceHistory } from "./db/schema/token_price_history.js";
export type {
  TokenPriceHistoryDocument,
} from "./db/schema/token_price_history.js";

export { tokenPrice24hAgoView } from "./db/schema/token_price_24h_ago_view.js";

// ===== TOKEN PRICES =====
export * from "./db/schema/token_prices.js";
