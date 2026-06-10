import "dotenv/config";
import {
  connectToDatabase,
  disconnectFromDatabase,
  tokenPriceHistory,
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

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  await connectToDatabase();

  const now = new Date();
  const fallbackDays = readNumberArg("fallback-days", 1);
  const latestPrice = await (tokenPriceHistory as any)
    .findOne({}, { timestamp: 1 })
    .sort({ timestamp: -1 })
    .lean();

  const latestTimestamp = latestPrice?.timestamp ? new Date(latestPrice.timestamp) : null;
  const latestTime = latestTimestamp?.getTime() ?? NaN;
  const days = Number.isFinite(latestTime)
    ? Math.max(0.05, Math.ceil(((now.getTime() - latestTime) / (24 * 60 * 60 * 1000)) * 100) / 100)
    : fallbackDays;

  const result = await TokenPriceService.backfillHistoricalPrices({
    concurrency: readNumberArg("concurrency", 1),
    days,
    delayMs: readNonNegativeNumberArg("delay-ms", 1500),
    existingToleranceMinutes: readNumberArg("existing-tolerance-minutes", 90),
    intervalHours: readNumberArg("interval-hours", 1),
    maxRetries: readNumberArg("max-retries", 3),
    recentOnlyDays: days,
    retryDelayMs: readNonNegativeNumberArg("retry-delay-ms", 10000),
    skipExisting: hasFlag("skip-existing"),
    targetHoursAgo: readNumberArg("target-hours-ago", 1),
  });

  console.log(JSON.stringify({
    ...result,
    fromLatestPriceAt: latestTimestamp?.toISOString() ?? null,
    days,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("Backfill active proposal price history failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });
