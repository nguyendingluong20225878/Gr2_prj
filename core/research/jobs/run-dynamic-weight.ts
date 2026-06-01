import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "../../shared/src/index.js";
import { acquireJobLock, releaseJobLock } from "../services/job-lock.js";
import { updateRollingSourceWeights } from "../services/dynamic-weight-service.js";

function readNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  const parsed = raw ? Number(raw.slice(prefix.length)) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(): Promise<number> {
  await connectToDatabase();
  const lockId = "dynamic-source-weights";
  const owner = await acquireJobLock(lockId, 10 * 60 * 1000);
  if (!owner) {
    console.log("[DynamicWeight] Lock busy; skip.");
    return 0;
  }

  try {
    const summary = await updateRollingSourceWeights({
      windowDays: readNumberArg("window-days", 60),
      horizonHours: readNumberArg("horizon-hours", 24),
      minSamples: readNumberArg("min-samples", 5),
    });
    console.log(JSON.stringify({ status: "COMPLETED", ...summary }, null, 2));
    return 0;
  } finally {
    await releaseJobLock(lockId, owner);
    await mongoose.disconnect();
  }
}

main().then((code) => process.exit(code)).catch(async (error) => {
  console.error("[DynamicWeight] Failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
