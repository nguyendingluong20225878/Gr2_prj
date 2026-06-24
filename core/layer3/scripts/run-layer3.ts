import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectToDatabase } from "../../shared/src/index.js";
import { runLayer3Batch } from "../src/workflow.js";

function readPositiveIntegerArg(name: string, fallback: number): number {
  const safeFallback = Number.isFinite(fallback) && fallback > 0 ? Math.floor(fallback) : 10;
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return safeFallback;

  const parsed = Math.floor(Number(raw.slice(prefix.length)));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : safeFallback;
}

function readNonNegativeIntegerArg(name: string, fallback: number): number {
  const safeFallback = Number.isFinite(fallback) && fallback >= 0 ? Math.floor(fallback) : 15000;
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return safeFallback;

  const parsed = Math.floor(Number(raw.slice(prefix.length)));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : safeFallback;
}

async function main(): Promise<number> {
  console.log("[LAYER 3] Starting AI reasoning workflow...");
  let exitCode = 0;

  try {
    await connectToDatabase();

    const summary = await runLayer3Batch({
      limit: readPositiveIntegerArg("limit", Number(process.env.LAYER3_BATCH_LIMIT ?? 10)),
      delayMs: readNonNegativeIntegerArg("delay-ms", Number(process.env.LAYER3_DELAY_MS ?? 15000)),
    });

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error("[Layer3] Workflow failed:", error);
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }

  return exitCode;
}

main()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error("[Layer3] Unexpected shutdown failure:", error);
    process.exit(1);
  });
