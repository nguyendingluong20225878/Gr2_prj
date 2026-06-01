import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "../../shared/src/index.js";
import { acquireJobLock, releaseJobLock } from "../services/job-lock.js";
import { computeRollingMetrics } from "../services/rolling-metrics-service.js";

function readNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  const parsed = raw ? Number(raw.slice(prefix.length)) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(): Promise<number> {
  await connectToDatabase();
  const lockId = "rolling-metrics";
  const owner = await acquireJobLock(lockId, 4 * 60 * 1000);
  if (!owner) {
    console.log("[RollingMetrics] Lock busy; skip.");
    return 0;
  }

  try {
    const results = await computeRollingMetrics({
      windowHours: readNumberArg(
        "window-hours",
        Number(process.env.ROLLING_METRICS_WINDOW_HOURS ?? 7 * 24)
      ),
      bucketMinutes: readNumberArg("bucket-minutes", 15),
      minSamples: readNumberArg("min-samples", 6),
    });
    const regime = results[0]?.marketRegime ?? "mixed";
    console.log(JSON.stringify({
      status: "COMPLETED",
      rows: results.length,
      regime,
      asOf: results[0]?.asOf ?? new Date(),
    }, null, 2));
    return 0;
  } finally {
    await releaseJobLock(lockId, owner);
    await mongoose.disconnect();
  }
}

main().then((code) => process.exit(code)).catch(async (error) => {
  console.error("[RollingMetrics] Failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
