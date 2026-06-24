import {
  DEFAULT_HYPER_PARAMS,
  DetectorHyperParams,
} from "../../signal-detector/src/index.js";
import { BacktestSummary } from "./engine.js";

export type HyperParamCandidate = DetectorHyperParams;

export type HyperParamSearchResult = {
  candidate: HyperParamCandidate;
  summary: BacktestSummary;
  objectiveScore: number;
};

export type ObjectiveWeights = {
  pnl: number;
  winRate: number;
  tradeCount: number;
  maxDrawdown: number;
};

const DEFAULT_OBJECTIVE_WEIGHTS: ObjectiveWeights = {
  pnl: 1,
  winRate: 500,
  tradeCount: 0.25,
  maxDrawdown: 0.5,
};

function uniq<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function createDefaultHyperParamGrid(): HyperParamCandidate[] {
  const alphaBlend = [0.5, 0.6, 0.7, 0.8, 0.9];
  const signalThreshold = [0.8, 1.0, 1.2, 1.4];
  const actionThreshold = [1.5, 1.8, 2.0];
  const holdSignalThreshold = [1.8, 2.0, 2.2];
  const tweetHalfLifeHours = [2, 4, 8, 12];
  const newsHalfLifeHours = [12, 24, 48];

  const candidates: HyperParamCandidate[] = [];
  for (const alpha of alphaBlend) {
    for (const signal of signalThreshold) {
      for (const action of actionThreshold) {
        for (const hold of holdSignalThreshold) {
          if (hold < action) continue;
          for (const tweetHalfLife of tweetHalfLifeHours) {
            for (const newsHalfLife of newsHalfLifeHours) {
              candidates.push({
                ...DEFAULT_HYPER_PARAMS,
                alphaBlend: alpha,
                signalThreshold: signal,
                actionThreshold: action,
                holdSignalThreshold: hold,
                tweetHalfLifeHours: tweetHalfLife,
                newsHalfLifeHours: newsHalfLife,
              });
            }
          }
        }
      }
    }
  }

  return uniq(candidates.map((candidate) => JSON.stringify(candidate))).map(
    (candidate) => JSON.parse(candidate) as HyperParamCandidate
  );
}

export function scoreBacktestSummary(
  summary: BacktestSummary,
  weights: ObjectiveWeights = DEFAULT_OBJECTIVE_WEIGHTS
): number {
  if (summary.evaluated === 0) return Number.NEGATIVE_INFINITY;

  return (
    summary.totalPnL * weights.pnl +
    summary.winRate * weights.winRate +
    Math.log1p(summary.evaluated) * weights.tradeCount -
    summary.maxDrawdownUsd * weights.maxDrawdown
  );
}

export function rankHyperParamResults(
  results: Array<{ candidate: HyperParamCandidate; summary: BacktestSummary }>,
  weights?: ObjectiveWeights
): HyperParamSearchResult[] {
  return results
    .map((result) => ({
      ...result,
      objectiveScore: scoreBacktestSummary(result.summary, weights),
    }))
    .sort((a, b) => b.objectiveScore - a.objectiveScore);
}
