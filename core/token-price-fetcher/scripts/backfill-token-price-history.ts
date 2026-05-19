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

async function main() {
  await connectToDatabase();

  const result = await TokenPriceService.backfillHistoricalPrices({
    days: readNumberArg("days", 30),
    delayMs: readNonNegativeNumberArg("delay-ms", 1500),
    intervalHours: readNumberArg("interval-hours", 1),
    maxRetries: readNumberArg("max-retries", 3),
    retryDelayMs: readNonNegativeNumberArg("retry-delay-ms", 10000),
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
