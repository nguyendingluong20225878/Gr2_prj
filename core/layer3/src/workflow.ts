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
  volatilityFlag?: number;
  detectedAt?: Date;
  uncertaintyEntropy?: number;
  realizedVolatility?: number | null;
  signalMode?: string | null;
  expiresAt?: Date;
  metadata?: {
    scoreComponents?: Record<string, unknown>;
    uncertaintyEntropy?: number;
    signalMode?: string;
  };
  suggestionType?: string;
  sentimentType?: string;
  sources?: SourceRef[];
  layer3RetryCount?: number;
  layer3LockedBy?: string | null;
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  await proposalsTable.updateOne(
    { signalId: signal._id },
    {
      $set: {
        tokenSymbol: signal.tokenSymbol,
        tokenAddress: signal.tokenAddress,
        suggestionType: signal.suggestionType,
        sentimentType: signal.sentimentType,
        quantScore: signal.quantScore,
        confidence: signal.confidence,
        volatilityFlag: signal.volatilityFlag ?? null,
        uncertaintyEntropy: signal.uncertaintyEntropy ?? signal.metadata?.uncertaintyEntropy ?? null,
        realizedVolatility: signal.realizedVolatility ?? null,
        signalMode: signal.signalMode ?? signal.metadata?.signalMode ?? null,
        detectedAt: signal.detectedAt ?? null,
        scoreComponents: signal.metadata?.scoreComponents ?? {},
        expiresAt: signal.expiresAt ?? null,
        sources: signal.sources ?? [],
        rationaleSummary: finalState.rationaleSummary,
        executionStatus: "PENDING",
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  await signalsTable.updateOne(
    layer3OwnershipFilter(signal),
    {
      $set: {
        status: "PROCESSED",
        updatedAt: new Date(),
        layer3LockedAt: null,
        layer3LockedBy: null,
      },
    }
  );

  return { status: "PROCESSED" as const, tokenSymbol: signal.tokenSymbol };
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
