import "dotenv/config";
import {
  connectToDatabase,
  disconnectFromDatabase,
} from "@gr2/shared";
import { TokenPriceService } from "../src/index.js";

function readPositiveNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  const value = raw ? Number(raw.slice(prefix.length)) : fallback;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readNonNegativeNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  const value = raw ? Number(raw.slice(prefix.length)) : fallback;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

async function main() {
  await connectToDatabase();
  const result = await TokenPriceService.capturePriceHistorySnapshot({
    batchSize: readPositiveNumberArg("batch-size", 50),
    delayMs: readNonNegativeNumberArg("delay-ms", 15000),
    maxRetries: readPositiveNumberArg("max-retries", 3),
    retryDelayMs: readNonNegativeNumberArg("retry-delay-ms", 60000),
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("Capture token price history snapshot failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });
