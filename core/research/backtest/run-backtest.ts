import "dotenv/config";
import { disconnectFromDatabase } from "@gr2/shared";
import { runProposalBacktest } from "./engine.js";
import { createDefaultHyperParamGrid } from "./hyperparameter-grid.js";

function readNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;

  const value = Number(raw.slice(prefix.length));
  return Number.isFinite(value) ? value : fallback;
}

function readPositiveNumberArg(name: string, fallback: number): number {
  const value = readNumberArg(name, fallback);
  return value > 0 ? value : fallback;
}

function readNonNegativeNumberArg(name: string, fallback: number): number {
  const value = readNumberArg(name, fallback);
  return value >= 0 ? value : fallback;
}

function readPositiveIntegerArg(name: string, fallback: number): number {
  const value = Math.floor(readNumberArg(name, fallback));
  return value > 0 ? value : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  if (hasFlag("grid")) {
    const grid = createDefaultHyperParamGrid();
    console.log(JSON.stringify({
      status: "REPLAY_REQUIRED",
      message:
        "Grid candidates were generated, but true HPO must replay signal-detector with historical tweet/news snapshots before calling the PnL evaluator. Proposal backtest alone would return the same result for every candidate.",
      candidateCount: grid.length,
      sampleCandidates: grid.slice(0, 5),
    }, null, 2));
    return;
  }

  const summary = await runProposalBacktest({
    horizonHours: readPositiveNumberArg("horizon-hours", 24),
    batchSize: readPositiveIntegerArg("batch-size", 25),
    delayMs: readNonNegativeNumberArg("delay-ms", 350),
    batchDelayMs: readNonNegativeNumberArg("batch-delay-ms", 1500),
    feeRate: readNonNegativeNumberArg("fee-rate", 0.001),
    slippageRate: readNonNegativeNumberArg("slippage-rate", 0.001),
    notionalUsd: readPositiveNumberArg("notional-usd", 1000),
    holdMoveThreshold: readNonNegativeNumberArg("hold-move-threshold", 0.01),
    persist: !hasFlag("dry-run"),
    allowCurrentPriceFallback: hasFlag("allow-current-price-fallback")
      ? true
      : undefined,
  });

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error("Backtest failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });
