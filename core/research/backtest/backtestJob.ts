import {
  runProposalBacktest,
  type BacktestEngineOptions,
  type BacktestSummary,
} from "./engine.js";

export type BacktestJobOptions = BacktestEngineOptions;

export async function runBacktestJob(
  options: BacktestJobOptions = {}
): Promise<BacktestSummary> {
  return runProposalBacktest(options);
}
