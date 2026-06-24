import {
  newsArticlesTable,
  signalsTable,
  tweetTable,
} from "../../shared/src/index.js";
import { proposalsTable } from "../../shared/src/db/schema/proposal.js";
import { layer3Graph } from "./agent.js";
import type { ProposalState } from "./state.js";

type SourceRef = {
  label?: string;
  url?: string;
};

type RawSignal = {
  _id: { toString(): string };
  tokenSymbol?: string;
  tokenAddress?: string;
  quantScore?: number;
  confidence?: number;
  batchId?: string | null;
  batchStartedAt?: Date | null;
  volatilityFlag?: number;
  detectedAt?: Date;
  uncertaintyEntropy?: number;
  realizedVolatility?: number | null;
  signalMode?: string | null;
  expiresAt?: Date;
  metadata?: {
    batchId?: string;
    batchStartedAt?: Date;
    scoreComponents?: Record<string, unknown>;
    uncertaintyEntropy?: number;
    signalMode?: string;
  };
  suggestionType?: string;
  sentimentType?: string;
  sources?: SourceRef[];
  layer3RetryCount?: number;
  layer3LockedBy?: string | null;
  nextLayer3RetryAt?: Date | null;
  updatedAt?: Date;
};

export type Layer3WorkflowOptions = {
  limit?: number;
  sourceContentLimit?: number;
  delayMs?: number;
  maxRetry?: number;
};

const DEFAULT_OPTIONS = {
  limit: 10,
  sourceContentLimit: 100000,
  delayMs: 15000,
  maxRetry: 3,
};
const PROCESSING_TTL_MS = 10 * 60 * 1000;
const DEFAULT_RECOMMENDATION_TTL_HOURS = 23.75;
const DEFAULT_RETRY_BACKOFF_MS = 10 * 60 * 1000;
const DEFAULT_RETRY_BACKOFF_MAX_MS = 60 * 60 * 1000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function positiveNumberOrDefault(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function nonNegativeNumberOrDefault(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function getLayer3RetryBackoffMs(retryCount: number) {
  const baseBackoffMs = positiveNumberOrDefault(
    process.env.LAYER3_RETRY_BACKOFF_MS,
    DEFAULT_RETRY_BACKOFF_MS
  );
  const maxBackoffMs = positiveNumberOrDefault(
    process.env.LAYER3_RETRY_BACKOFF_MAX_MS,
    DEFAULT_RETRY_BACKOFF_MAX_MS
  );
  const exponent = Math.max(0, retryCount - 1);
  const rawBackoff = Math.min(baseBackoffMs * (2 ** exponent), maxBackoffMs);
  const jitterRatio = nonNegativeNumberOrDefault(process.env.LAYER3_RETRY_JITTER_RATIO, 0.2);
  const jitter = rawBackoff * Math.min(jitterRatio, 1) * Math.random();
  return Math.floor(Math.min(rawBackoff + jitter, maxBackoffMs));
}

function isRetryableLayer3ProviderError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "retryable" in error &&
    (error as { retryable?: unknown }).retryable === true
  );
}

function layer3ErrorCode(error: unknown) {
  if (error && typeof error === "object" && "statusCode" in error) {
    return (error as { statusCode?: unknown }).statusCode ?? null;
  }
  return null;
}

function validDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function resolveSignalBatchStartedAt(signal: RawSignal) {
  return (
    validDate(signal.batchStartedAt) ??
    validDate(signal.metadata?.batchStartedAt) ??
    validDate(signal.detectedAt) ??
    new Date()
  );
}

function resolveSignalBatchId(signal: RawSignal) {
  return signal.batchId ?? signal.metadata?.batchId ?? resolveSignalBatchStartedAt(signal).toISOString();
}

function resolveRecommendationExpiresAt(startsAt: Date) {
  const ttlHours = positiveNumberOrDefault(
    process.env.LAYER3_RECOMMENDATION_TTL_HOURS,
    DEFAULT_RECOMMENDATION_TTL_HOURS
  );
  return new Date(startsAt.getTime() + ttlHours * 60 * 60 * 1000);
}

function getRecommendationTtlMs() {
  const ttlHours = positiveNumberOrDefault(
    process.env.LAYER3_RECOMMENDATION_TTL_HOURS,
    DEFAULT_RECOMMENDATION_TTL_HOURS
  );
  return ttlHours * 60 * 60 * 1000;
}

function getSignalFreshnessCutoff(now: Date) {
  return new Date(now.getTime() - getRecommendationTtlMs());
}

function getBatchTime(value: unknown) {
  const date = validDate(value);
  return date ? date.getTime() : null;
}

function compareSignalToProposalBatch(signal: RawSignal, proposal: any) {
  const signalBatchId = resolveSignalBatchId(signal);
  const proposalBatchId = proposal.batchId ? String(proposal.batchId) : null;
  if (signalBatchId && proposalBatchId && signalBatchId === proposalBatchId) return 0;

  const signalBatchTime = getBatchTime(resolveSignalBatchStartedAt(signal));
  const proposalBatchTime =
    getBatchTime(proposal.batchStartedAt) ??
    getBatchTime(proposal.detectedAt) ??
    getBatchTime(proposal.createdAt);

  if (signalBatchTime !== null && proposalBatchTime !== null) {
    if (signalBatchTime > proposalBatchTime) return 1;
    if (signalBatchTime < proposalBatchTime) return -1;
    return 0;
  }

  if (signalBatchId && proposalBatchId) return signalBatchId.localeCompare(proposalBatchId);
  return 1;
}

function shouldReplaceWithinBatch(signal: RawSignal, proposal: any) {
  const signalScore = Math.abs(Number(signal.quantScore ?? 0));
  const proposalScore = Math.abs(Number(proposal.quantScore ?? 0));
  return signalScore > proposalScore;
}

async function markSignalProcessed(signal: RawSignal, extra: Record<string, unknown> = {}) {
  await signalsTable.updateOne(
    layer3OwnershipFilter(signal),
    {
      $set: {
        status: "PROCESSED",
        updatedAt: new Date(),
        layer3LockedAt: null,
        layer3LockedBy: null,
        nextLayer3RetryAt: null,
        lastLayer3Error: null,
        lastLayer3ErrorCode: null,
        errorType: null,
        ...extra,
      },
    }
  );
}

async function expireElapsedActiveRecommendations(now: Date) {
  await proposalsTable.updateMany(
    {
      lifecycleStatus: "ACTIVE",
      $or: [
        { expiresAt: { $lte: now } },
        { expiresAt: null },
        { expiresAt: { $exists: false } },
      ],
    },
    {
      $set: {
        lifecycleStatus: "EXPIRED",
        expiredAt: now,
        updatedAt: now,
      },
    }
  );
}

async function skipExpiredRawSignals(now: Date) {
  const staleBefore = new Date(now.getTime() - PROCESSING_TTL_MS);
  const cutoff = getSignalFreshnessCutoff(now);
  const result = await signalsTable.updateMany(
    {
      detectedAt: { $lte: cutoff },
      $or: [
        { status: "RAW" },
        { status: "PROCESSING", layer3LockedAt: { $lte: staleBefore } },
      ],
    },
    {
      $set: {
        status: "SKIPPED",
        layer3Decision: "SKIPPED_EXPIRED_BEFORE_LAYER3",
        layer3SkippedAt: now,
        layer3LockedAt: null,
        layer3LockedBy: null,
        updatedAt: now,
      },
    }
  );

  return result.modifiedCount ?? 0;
}

function validateRawSignal(signal: RawSignal): string | null {
  if (!signal._id) return "Missing signal id";
  if (!signal.tokenSymbol) return "Missing tokenSymbol";
  if (!signal.tokenAddress) return "Missing tokenAddress";
  if (!signal.suggestionType) return "Missing suggestionType";
  if (!signal.sentimentType) return "Missing sentimentType";
  return null;
}

async function resolveSourceContent(source: SourceRef): Promise<string> {
  if (!source.url) return "";

  if (source.label === "News Article") {
    const article = await newsArticlesTable.findOne({ articleUrl: source.url }).lean();
    if (!article) return `[News missing content]: ${source.url}\n\n`;

    const textContent = String(article.content || article.summary || "No text content");
    return `[News - ${article.title}]\nContent: ${textContent}\n\n`;
  }

  if (source.label === "X (Twitter)") {
    const tweet = await tweetTable.findOne({ url: source.url }).lean();
    if (!tweet) return `[Tweet missing content]: ${source.url}\n\n`;

    const rawText = String(tweet.text || tweet.content || "");
    const cleanText = rawText.replace(/https:\/\/t\.co\/\w+/g, "").trim();
    return `[Tweet]: ${cleanText}\n\n`;
  }

  return `[Source]: ${source.url}\n\n`;
}

export async function enrichSignalSources(
  signal: RawSignal,
  contentLimit = DEFAULT_OPTIONS.sourceContentLimit
): Promise<string> {
  const chunks: string[] = [];

  for (const source of signal.sources ?? []) {
    try {
      chunks.push(await resolveSourceContent(source));
    } catch (error) {
      console.warn(`[Layer3] Skipping source ${source.url}:`, error);
    }
  }

  return chunks.join("").slice(0, contentLimit) || "Không có nội dung văn bản cụ thể.";
}

export function toProposalState(signal: RawSignal, sourcesContent: string): ProposalState {
  return {
    signalId: signal._id.toString(),
    tokenSymbol: signal.tokenSymbol || "UNKNOWN",
    quantScore: signal.quantScore || 0,
    confidence: signal.confidence || 0,
    suggestionType: signal.suggestionType || "hold",
    sourcesContent,
    messages: [],
  };
}

function layer3OwnershipFilter(signal: RawSignal) {
  return {
    _id: signal._id,
    status: "PROCESSING",
    ...(signal.layer3LockedBy ? { layer3LockedBy: signal.layer3LockedBy } : {}),
  };
}

export async function processSignal(signal: RawSignal, options: Layer3WorkflowOptions = {}) {
  const now = new Date();
  const validationError = validateRawSignal(signal);
  if (validationError) {
    await signalsTable.updateOne(
      layer3OwnershipFilter(signal),
      {
        $set: {
          status: "FAILED",
          updatedAt: new Date(),
          error: validationError,
          layer3LockedAt: null,
          layer3LockedBy: null,
        },
      }
    );
    return { status: "FAILED" as const, reason: validationError };
  }

  await expireElapsedActiveRecommendations(now);

  const recommendationStartsAt = validDate(signal.detectedAt) ?? resolveSignalBatchStartedAt(signal);
  const expiresAt = resolveRecommendationExpiresAt(recommendationStartsAt);
  if (expiresAt <= now) {
    await signalsTable.updateOne(
      layer3OwnershipFilter(signal),
      {
        $set: {
          status: "SKIPPED",
          layer3Decision: "SKIPPED_EXPIRED_BEFORE_LAYER3",
          layer3SkippedAt: now,
          layer3LockedAt: null,
          layer3LockedBy: null,
          updatedAt: now,
        },
      }
    );
    return { status: "SKIPPED_EXPIRED" as const, tokenSymbol: signal.tokenSymbol };
  }

  // Only currently active, unexpired proposals block a new Layer 3 proposal.
  // Expired/overridden historical proposals for the same token must not prevent a fresh signal.
  const activeProposal = await (proposalsTable as any)
    .findOne({
      tokenAddress: signal.tokenAddress,
      lifecycleStatus: "ACTIVE",
      expiresAt: { $gt: now },
    })
    .sort({ batchStartedAt: -1, createdAt: -1 })
    .lean();

  if (activeProposal) {
    const batchComparison = compareSignalToProposalBatch(signal, activeProposal);

    if (batchComparison < 0) {
      await markSignalProcessed(signal, {
        layer3Decision: "IGNORED_OLD_BATCH",
      });
      return { status: "IGNORED_OLD_BATCH" as const, tokenSymbol: signal.tokenSymbol };
    }

    if (batchComparison === 0 && !shouldReplaceWithinBatch(signal, activeProposal)) {
      await markSignalProcessed(signal, {
        layer3Decision: "IGNORED_WEAKER_SAME_BATCH",
      });
      return { status: "IGNORED_SAME_BATCH" as const, tokenSymbol: signal.tokenSymbol };
    }
  }

  const sourcesContent = await enrichSignalSources(
    signal,
    options.sourceContentLimit ?? DEFAULT_OPTIONS.sourceContentLimit
  );
  const initialState = toProposalState(signal, sourcesContent);
  const finalState = await layer3Graph.invoke(initialState);
  const stillOwned = await signalsTable.exists(layer3OwnershipFilter(signal));
  if (!stillOwned) {
    return { status: "STALE_CLAIM" as const, tokenSymbol: signal.tokenSymbol };
  }

  const batchStartedAt = resolveSignalBatchStartedAt(signal);
  const batchId = resolveSignalBatchId(signal);
  const proposalWrittenAt = new Date();
  const replacesSameBatch = activeProposal
    ? compareSignalToProposalBatch(signal, activeProposal) === 0
    : false;
  const isCrossBatchOverride = activeProposal
    ? compareSignalToProposalBatch(signal, activeProposal) > 0
    : false;
  const proposalFilter = replacesSameBatch
    ? { _id: activeProposal._id }
    : { signalId: signal._id };

  let oldProposalMarkedOverridden = false;
  if (isCrossBatchOverride && activeProposal) {
    await proposalsTable.updateOne(
      { _id: activeProposal._id, lifecycleStatus: "ACTIVE" },
      {
        $set: {
          lifecycleStatus: "OVERRIDDEN",
          overriddenAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
    oldProposalMarkedOverridden = true;
  }

  let writeResult;
  try {
    writeResult = await proposalsTable.updateOne(
      proposalFilter,
      {
        $set: {
          signalId: signal._id,
          tokenSymbol: signal.tokenSymbol,
          tokenAddress: signal.tokenAddress,
          suggestionType: signal.suggestionType,
          sentimentType: signal.sentimentType,
          quantScore: signal.quantScore,
          confidence: signal.confidence,
          batchId,
          batchStartedAt,
          lifecycleStatus: "ACTIVE",
          overriddenAt: null,
          overriddenByProposalId: null,
          expiredAt: null,
          volatilityFlag: signal.volatilityFlag ?? null,
          uncertaintyEntropy: signal.uncertaintyEntropy ?? signal.metadata?.uncertaintyEntropy ?? null,
          realizedVolatility: signal.realizedVolatility ?? null,
          signalMode: signal.signalMode ?? signal.metadata?.signalMode ?? null,
          detectedAt: signal.detectedAt ?? null,
          signalUpdatedAt: signal.updatedAt ?? null,
          scoreComponents: signal.metadata?.scoreComponents ?? {},
          expiresAt,
          sources: signal.sources ?? [],
          rationaleSummary: finalState.rationaleSummary,
          executionStatus: "PENDING",
          entryPrice: null,
          exitPrice: null,
          actualPnL: null,
          winLossStatus: null,
          pnlPercentage: null,
          backtestedAt: null,
          backtestMeta: {},
          updatedAt: proposalWrittenAt,
        },
        $setOnInsert: { createdAt: proposalWrittenAt },
      },
      { upsert: true }
    );
  } catch (error) {
    if (oldProposalMarkedOverridden && activeProposal) {
      await proposalsTable.updateOne(
        { _id: activeProposal._id, lifecycleStatus: "OVERRIDDEN", overriddenByProposalId: null },
        {
          $set: {
            lifecycleStatus: "ACTIVE",
            overriddenAt: null,
            updatedAt: new Date(),
          },
        }
      );
    }
    throw error;
  }

  if (isCrossBatchOverride && activeProposal) {
    const newProposal = await (proposalsTable as any)
      .findOne({ signalId: signal._id }, { _id: 1 })
      .lean();
    await proposalsTable.updateOne(
      { _id: activeProposal._id },
      {
        $set: {
          lifecycleStatus: "OVERRIDDEN",
          overriddenAt: new Date(),
          overriddenByProposalId: newProposal?._id ?? null,
          updatedAt: new Date(),
        },
      }
    );
  }

  await markSignalProcessed(signal, {
    layer3Decision: replacesSameBatch
      ? "REPLACED_STRONGER_SAME_BATCH"
      : isCrossBatchOverride
        ? "OVERRIDDEN_PREVIOUS_BATCH"
        : "CREATED_ACTIVE",
    layer3ProposalWrite: {
      matchedCount: writeResult.matchedCount,
      modifiedCount: writeResult.modifiedCount,
      upsertedId: writeResult.upsertedId ?? null,
    },
  });

  return {
    status: replacesSameBatch
      ? "REPLACED_SAME_BATCH" as const
      : isCrossBatchOverride
        ? "OVERRIDDEN_PREVIOUS_BATCH" as const
        : "PROCESSED" as const,
    tokenSymbol: signal.tokenSymbol,
  };
}

async function claimNextRawSignal(options: Required<Layer3WorkflowOptions>): Promise<RawSignal | null> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_TTL_MS);
  const freshnessCutoff = getSignalFreshnessCutoff(now);
  const workerId = `${process.pid}:${now.toISOString()}`;
  const claimed = await signalsTable.findOneAndUpdate(
    {
      detectedAt: { $gt: freshnessCutoff },
      $or: [
        { status: "RAW" },
        { status: "PROCESSING", layer3LockedAt: { $lte: staleBefore } },
      ],
      $and: [
        {
          $or: [
            { layer3RetryCount: { $exists: false } },
            { layer3RetryCount: { $lt: options.maxRetry } },
          ],
        },
        {
          $or: [
            { nextLayer3RetryAt: { $exists: false } },
            { nextLayer3RetryAt: null },
            { nextLayer3RetryAt: { $lte: now } },
          ],
        },
      ],
    },
    {
      $set: {
        status: "PROCESSING",
        layer3LockedAt: now,
        layer3LockedBy: workerId,
        updatedAt: now,
      },
    },
    {
      sort: { detectedAt: -1, createdAt: -1 },
      returnDocument: "after",
    }
  ).lean();

  return claimed as RawSignal | null;
}

export async function runLayer3Batch(options: Layer3WorkflowOptions = {}) {
  const envMaxRetry = Number(process.env.LAYER3_MAX_RETRY ?? DEFAULT_OPTIONS.maxRetry);
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    maxRetry: Number.isFinite(envMaxRetry) && envMaxRetry > 0
      ? Math.floor(envMaxRetry)
      : DEFAULT_OPTIONS.maxRetry,
  };
  const skippedExpiredRaw = await skipExpiredRawSignals(new Date());
  const results = [];

  for (let index = 0; index < mergedOptions.limit; index += 1) {
    const signal = await claimNextRawSignal(mergedOptions);
    if (!signal) break;

    try {
      results.push(await processSignal(signal, mergedOptions));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      const nextRetryCount = Number(signal.layer3RetryCount ?? 0) + 1;
      const retryExhausted = nextRetryCount >= mergedOptions.maxRetry;
      const retryableProviderError = isRetryableLayer3ProviderError(error);
      const finalFailure = !retryableProviderError || retryExhausted;
      const nextLayer3RetryAt = retryableProviderError && !finalFailure
        ? new Date(Date.now() + getLayer3RetryBackoffMs(nextRetryCount))
        : null;
      const status = finalFailure ? "FAILED" : "RAW";
      await signalsTable.updateOne(
        layer3OwnershipFilter(signal),
        {
          $set: {
            status,
            updatedAt: new Date(),
            lastLayer3Error: reason,
            lastLayer3ErrorCode: layer3ErrorCode(error),
            nextLayer3RetryAt,
            layer3LockedAt: null,
            layer3LockedBy: null,
            errorType: retryExhausted
              ? "LAYER3_RETRY_EXHAUSTED"
              : retryableProviderError
                ? "LAYER3_PROVIDER_RETRYABLE"
                : "LAYER3_NON_RETRYABLE_ERROR",
          },
          $inc: { layer3RetryCount: 1 },
        }
      );
      results.push({
        status: finalFailure ? "FAILED" as const : "RETRYABLE_FAILED" as const,
        tokenSymbol: signal.tokenSymbol,
        reason,
        retryCount: nextRetryCount,
        ...(nextLayer3RetryAt ? { nextLayer3RetryAt } : {}),
      });
    }

    if (mergedOptions.delayMs > 0) {
      await delay(mergedOptions.delayMs);
    }
  }

  return { processed: results.length, skippedExpiredRaw, results };
}
