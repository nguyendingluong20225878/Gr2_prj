import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectToDatabase } from "../../shared/src/index.js";
import { runLayer3Batch } from "../src/workflow.js";

function readPositiveIntegerArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;

  const parsed = Math.floor(Number(raw.slice(prefix.length)));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(): Promise<number> {
  console.log("[LAYER 3] Starting AI reasoning workflow...");
  let exitCode = 0;

  try {
    await connectToDatabase();

    const summary = await runLayer3Batch({
      limit: readPositiveIntegerArg("limit", 10),
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
