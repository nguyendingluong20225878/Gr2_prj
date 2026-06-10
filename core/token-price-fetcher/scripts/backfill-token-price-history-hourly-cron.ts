import "dotenv/config";
import cron from "node-cron";
import {
  connectToDatabase,
  disconnectFromDatabase,
} from "@gr2/shared";
import { TokenPriceService } from "../src/index.js";

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

async function runHourlyBackfill() {
  const result = await TokenPriceService.backfillHistoricalPrices({
    concurrency: readNumberArg("concurrency", 1),
    days: readNumberArg("days", 0.05),
    delayMs: readNonNegativeNumberArg("delay-ms", 15000),
    existingToleranceMinutes: readNumberArg("existing-tolerance-minutes", 90),
    intervalHours: readNumberArg("interval-hours", 1),
    maxRetries: readNumberArg("max-retries", 3),
    recentOnlyDays: readNumberArg("recent-only-days", 1),
    retryDelayMs: readNonNegativeNumberArg("retry-delay-ms", 60000),
    skipExisting: true,
    targetHoursAgo: readNumberArg("target-hours-ago", 1),
  });

  console.log(JSON.stringify({
    ...result,
    ranAt: new Date().toISOString(),
  }, null, 2));
}

async function main() {
  await connectToDatabase();
  const cronExpression = process.env.PRICE_HISTORY_BACKFILL_CRON || "0 * * * *";
  console.log(`Backfill token price history hourly cron: ${cronExpression}`);

  await runHourlyBackfill();

  cron.schedule(cronExpression, async () => {
    try {
      await runHourlyBackfill();
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
