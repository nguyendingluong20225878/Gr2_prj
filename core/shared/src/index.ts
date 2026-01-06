// ===== DB =====
export * from "./db";
export { getProposalModel, ProposalDocument } from "./db/schema/proposals";
export { tweetTable } from "./db/schema/tweets";
export { xAccountTable } from "./db/schema/x_accounts";
// ===== TYPES =====
// export {
//   LogLevel,
// } from "./types";

// export type {
//   LogEntry,
//   LoggerConfig,
//   LogWriter,
//  // CryptoAnalysis,
  
// } from "./types";
export * from "./types";
// ===== UTILS =====
export {
  Logger,
  logger,
} from "./utils/logger";

export {
  createDbLog,
  logProcessing,
  logSuccess,
  logFailed,
} from "./utils/db-logging";

export type {
  DbLogEntry,
  DbLogStatus,
} from "./utils/db-logging";

// ===== REPOSITORIES =====
export type {
  XAccountRepository,
  TweetRepository,
} from "./repositories/interface";

// ===== CONSTANTS =====
export * from "./constants";
