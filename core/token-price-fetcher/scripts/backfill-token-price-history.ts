import "dotenv/config";
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

function readStringListArg(name: string): string[] | undefined {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return undefined;

  return raw
    .slice(prefix.length)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  await connectToDatabase();
  const demoMode = hasFlag("demo");

  const result = await TokenPriceService.backfillHistoricalPrices({
    concurrency: readNumberArg("concurrency", demoMode ? 3 : 1),
    days: readNumberArg("days", demoMode ? 2 : 30),
    delayMs: readNonNegativeNumberArg("delay-ms", demoMode ? 0 : 15000),
    existingToleranceMinutes: readNumberArg("existing-tolerance-minutes", 90),
    intervalHours: readNumberArg("interval-hours", 1),
    maxRetries: readNumberArg("max-retries", demoMode ? 1 : 3),
    recentOnlyDays: readNumberArg("recent-only-days", demoMode ? 7 : 0),
    retryDelayMs: readNonNegativeNumberArg("retry-delay-ms", demoMode ? 2000 : 60000),
    skipExisting: hasFlag("skip-existing") || demoMode,
    targetHoursAgo: readNumberArg("target-hours-ago", 24),
    tokenIds: readStringListArg("ids"),
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("Backfill token price history failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });
