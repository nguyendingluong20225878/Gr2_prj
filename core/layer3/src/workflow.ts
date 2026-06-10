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
const DEFAULT_RECOMMENDATION_TTL_HOURS = 24;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function positiveNumberOrDefault(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
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

function resolveRecommendationExpiresAt(batchStartedAt: Date) {
  const ttlHours = positiveNumberOrDefault(
    process.env.LAYER3_RECOMMENDATION_TTL_HOURS,
    DEFAULT_RECOMMENDATION_TTL_HOURS
  );
  return new Date(batchStartedAt.getTime() + ttlHours * 60 * 60 * 1000);
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
        ...extra,
      },
    }
  );
}

async function expireElapsedActiveRecommendations(now: Date) {
  await proposalsTable.updateMany(
    {
      lifecycleStatus: "ACTIVE",
      expiresAt: { $lte: now },
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
  const expiresAt = resolveRecommendationExpiresAt(batchStartedAt);
  const replacesSameBatch = activeProposal
    ? compareSignalToProposalBatch(signal, activeProposal) === 0
    : false;
  const isCrossBatchOverride = activeProposal
    ? compareSignalToProposalBatch(signal, activeProposal) > 0
    : false;
  const proposalFilter = replacesSameBatch
    ? { _id: activeProposal._id }
    : { signalId: signal._id };

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
  }

  const writeResult = await proposalsTable.updateOne(
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
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

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
  const workerId = `${process.pid}:${now.toISOString()}`;
  const claimed = await signalsTable.findOneAndUpdate(
    {
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
      sort: { detectedAt: 1, createdAt: 1 },
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
      await signalsTable.updateOne(
        layer3OwnershipFilter(signal),
        {
          $set: {
            status: retryExhausted ? "FAILED" : "RAW",
            updatedAt: new Date(),
            lastLayer3Error: reason,
            layer3LockedAt: null,
            layer3LockedBy: null,
            ...(retryExhausted ? { errorType: "LAYER3_RETRY_EXHAUSTED" } : {}),
          },
          $inc: { layer3RetryCount: 1 },
        }
      );
      results.push({
        status: retryExhausted ? "FAILED" as const : "RETRYABLE_FAILED" as const,
        tokenSymbol: signal.tokenSymbol,
        reason,
      });
    }

    if (mergedOptions.delayMs > 0) {
      await delay(mergedOptions.delayMs);
    }
  }

  return { processed: results.length, results };
}
