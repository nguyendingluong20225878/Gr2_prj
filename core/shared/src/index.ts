// ===== DB =====
export * from "./db/index.js";
export * from "./db/connection.js";

// ===== PROPOSALS =====
export { getProposalModel, proposalsTable } from "./db/schema/proposal.js";
export type {
  Proposal,
  ProposalDocument,
  ProposalInsert,
} from "./db/schema/proposal.js";

// ===== SIGNALS =====
export { signalsTable } from "./db/schema/signals.js";

// ===== X / TWEETS =====
export { tweetTable } from "./db/schema/tweets.js";
export { xAccountTable } from "./db/schema/x_accounts.js";
export { newsSiteTable } from "./db/schema/news_sites.js";
export { newsArticlesTable } from "./db/schema/news_articles.js";
export { sourceWeightsTable } from "./db/schema/source_weights.js";
export { signalWeightsTable } from "./db/schema/signal_weights.js";
export { rollingMetricsTable } from "./db/schema/rolling_metrics.js";
export type {
  MarketRegime,
  RollingMetricDocument,
} from "./db/schema/rolling_metrics.js";

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
export type { TokenAlias, TokenDocument } from "./db/schema/tokens.js";
export {
  TokenIdentityResolver,
  resolveToken,
} from "./services/token-identity-resolver.js";
export type {
  ResolvedToken,
  ResolveTokenInput,
  ResolveTokenOptions,
} from "./services/token-identity-resolver.js";

export { tokenPriceHistory } from "./db/schema/token_price_history.js";
export type {
  TokenPriceHistoryDocument,
} from "./db/schema/token_price_history.js";

export { tokenPrice24hAgoView } from "./db/schema/token_price_24h_ago_view.js";

// ===== TOKEN PRICES =====
export * from "./db/schema/token_prices.js";

// ===== BACKTEST =====
export * from "./db/schema/backtest_results.js";
export * from "./db/schema/backtest_runs.js";
export * from "./db/schema/backtest_candidates.js";
export * from "./db/schema/hyperparameter_configs.js";
export * from "./db/schema/sentiment_cache.js";
export * from "./db/schema/rolling_metrics.js";
