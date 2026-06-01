import { createHash } from "crypto";
import {
  connectToDatabase,
  sentimentCacheTable,
} from "@gr2/shared";
import type { FinBERTProbs } from "../finbert.js";

export const FINBERT_MODEL_NAME =
  process.env.HF_FINBERT_MODEL_NAME ?? "ProsusAI/finbert";

export function hashSentimentText(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex");
}

function isValidCachedProbs(value: any): value is FinBERTProbs {
  return (
    value &&
    Number.isFinite(value.pPos) &&
    Number.isFinite(value.pNeg) &&
    Number.isFinite(value.pNeu)
  );
}

export async function readSentimentCache(
  text: string
): Promise<FinBERTProbs | null> {
  try {
    await connectToDatabase();
    const textHash = hashSentimentText(text);
    const cached = await sentimentCacheTable
      .findOne({ textHash, modelName: FINBERT_MODEL_NAME })
      .lean();

    if (!isValidCachedProbs(cached)) return null;
    return {
      pPos: Number(cached.pPos),
      pNeg: Number(cached.pNeg),
      pNeu: Number(cached.pNeu),
      baseScore: Number(cached.baseScore ?? cached.pPos - cached.pNeg),
    };
  } catch (error) {
    console.warn(
      "[FinBERT Cache] Read skipped:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export async function writeSentimentCache(
  text: string,
  probs: FinBERTProbs
): Promise<void> {
  try {
    await connectToDatabase();
    await sentimentCacheTable.updateOne(
      {
        textHash: hashSentimentText(text),
        modelName: FINBERT_MODEL_NAME,
      },
      {
        $set: {
          pPos: probs.pPos,
          pNeg: probs.pNeg,
          pNeu: probs.pNeu,
          baseScore: probs.baseScore,
          source: probs.baseScore === 0 ? "FALLBACK" : "HF_FINBERT",
          lastUsedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.warn(
      "[FinBERT Cache] Write skipped:",
      error instanceof Error ? error.message : String(error)
    );
  }
}
