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
  suggestionType?: string;
  sentimentType?: string;
  sources?: SourceRef[];
};

export type Layer3WorkflowOptions = {
  limit?: number;
  sourceContentLimit?: number;
  delayMs?: number;
};

const DEFAULT_OPTIONS = {
  limit: 10,
  sourceContentLimit: 100000,
  delayMs: 15000,
};

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

export async function processSignal(signal: RawSignal, options: Layer3WorkflowOptions = {}) {
  const validationError = validateRawSignal(signal);
  if (validationError) {
    await signalsTable.updateOne(
      { _id: signal._id },
      { $set: { status: "FAILED", updatedAt: new Date(), error: validationError } }
    );
    return { status: "FAILED" as const, reason: validationError };
  }

  const sourcesContent = await enrichSignalSources(
    signal,
    options.sourceContentLimit ?? DEFAULT_OPTIONS.sourceContentLimit
  );
  const initialState = toProposalState(signal, sourcesContent);
  const finalState = await layer3Graph.invoke(initialState);

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
    { _id: signal._id },
    { $set: { status: "PROCESSED", updatedAt: new Date() } }
  );

  return { status: "PROCESSED" as const, tokenSymbol: signal.tokenSymbol };
}

export async function runLayer3Batch(options: Layer3WorkflowOptions = {}) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const rawSignals = (await signalsTable
    .find({ status: "RAW" })
    .limit(mergedOptions.limit)
    .lean()) as RawSignal[];

  const results = [];

  for (const signal of rawSignals) {
    try {
      results.push(await processSignal(signal, mergedOptions));
    } catch (error) {
      await signalsTable.updateOne(
        { _id: signal._id },
        { $set: { status: "FAILED", updatedAt: new Date() } }
      );
      results.push({
        status: "FAILED" as const,
        tokenSymbol: signal.tokenSymbol,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }

    if (mergedOptions.delayMs > 0) {
      await delay(mergedOptions.delayMs);
    }
  }

  return { processed: results.length, results };
}
