import "dotenv/config";
import cron from "node-cron";
import {
  connectToDatabase,
  disconnectFromDatabase,
} from "@gr2/shared";
import { TokenPriceService } from "../src/index.js";

let hourlyBackfillRunning = false;

function readNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;

  const value = Number(raw.slice(prefix.length));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readNonNegativeNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;

  const value = Number(raw.slice(prefix.length));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

async function runHourlyBackfill(trigger: "startup" | "cron") {
  if (hourlyBackfillRunning) {
    console.warn(JSON.stringify({
      status: "SKIPPED_OVERLAP",
      trigger,
      reason: "Previous hourly price backfill is still running.",
      skippedAt: new Date().toISOString(),
    }, null, 2));
    return;
  }

  hourlyBackfillRunning = true;
  const startedAt = new Date();
  const configuredBatchSize = Number(process.env.PRICE_HISTORY_BATCH_SIZE ?? 50);

  try {
    const result = await TokenPriceService.capturePriceHistorySnapshot({
      batchSize: readNumberArg(
        "batch-size",
        Number.isFinite(configuredBatchSize) && configuredBatchSize > 0
          ? configuredBatchSize
          : 50
      ),
      delayMs: readNonNegativeNumberArg("delay-ms", 15000),
      maxRetries: readNumberArg("max-retries", 3),
      retryDelayMs: readNonNegativeNumberArg("retry-delay-ms", 60000),
    });
    const finishedAt = new Date();

    console.log(JSON.stringify({
      ...result,
      trigger,
      startedAt: startedAt.toISOString(),
      ranAt: finishedAt.toISOString(),
      durationSeconds: Math.round(
        (finishedAt.getTime() - startedAt.getTime()) / 1000
      ),
    }, null, 2));
  } finally {
    hourlyBackfillRunning = false;
  }
}

async function main() {
  await connectToDatabase();
  const cronExpression = process.env.PRICE_HISTORY_BACKFILL_CRON || "0 * * * *";
  console.log(`Backfill token price history hourly cron: ${cronExpression}`);

  await runHourlyBackfill("startup");

  cron.schedule(cronExpression, async () => {
    try {
      await runHourlyBackfill("cron");
    } catch (error) {
      console.error("Hourly price history backfill failed:", error);
    }
  });
}

main().catch(async (error) => {
  console.error("Start hourly price history backfill cron failed:", error);
  await disconnectFromDatabase();
  process.exit(1);
});
