import "dotenv/config";
import mongoose from "mongoose";
import {
  backtestCandidatesTable,
  backtestRunsTable,
  connectToDatabase,
  disconnectFromDatabase,
} from "../../shared/src/index.js";
import {
  DEFAULT_HYPER_PARAMS,
  loadActiveHyperParams,
  promoteCandidateConfig,
  saveCandidateConfig,
  type DetectorHyperParams,
} from "../../signal-detector/src/index.js";
import {
  createDefaultHyperParamGrid,
  scoreBacktestSummary,
} from "./hyperparameter-grid.js";
import { replayCandidateBacktest } from "./replay-engine.js";

type Fold = {
  trainFrom: Date;
  trainTo: Date;
  validationFrom: Date;
  validationTo: Date;
};

function readNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  const value = Number(raw?.slice(prefix.length));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function buildFolds(options: {
  trainDays: number;
  validationDays: number;
  folds: number;
}): Fold[] {
  const out: Fold[] = [];
  for (let index = options.folds - 1; index >= 0; index -= 1) {
    const validationTo = daysAgo(index * options.validationDays);
    const validationFrom = daysAgo(index * options.validationDays + options.validationDays);
    const trainTo = validationFrom;
    const trainFrom = new Date(trainTo.getTime() - options.trainDays * 24 * 60 * 60 * 1000);
    out.push({ trainFrom, trainTo, validationFrom, validationTo });
  }
  return out;
}

function guardrails(candidate: {
  evaluated: number;
  winRate: number;
  totalPnL: number;
  maxDrawdownUsd: number;
}, active: {
  winRate: number;
  totalPnL: number;
  maxDrawdownUsd: number;
}) {
  return (
    candidate.evaluated >= 20 &&
    candidate.totalPnL > 0 &&
    candidate.totalPnL >= active.totalPnL &&
    candidate.winRate >= Math.max(0.45, active.winRate - 0.02) &&
    candidate.maxDrawdownUsd <= Math.max(active.maxDrawdownUsd * 1.25, 100)
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function aggregateSummaries(summaries: Array<{
  evaluated: number;
  wins: number;
  losses: number;
  breakeven: number;
  totalPnL: number;
  totalPnlPercentage: number;
  maxDrawdownUsd: number;
}>) {
  const evaluated = summaries.reduce((sum, item) => sum + item.evaluated, 0);
  const wins = summaries.reduce((sum, item) => sum + item.wins, 0);
  const losses = summaries.reduce((sum, item) => sum + item.losses, 0);
  const breakeven = summaries.reduce((sum, item) => sum + item.breakeven, 0);
  return {
    evaluated,
    wins,
    losses,
    breakeven,
    winRate: evaluated > 0 ? wins / evaluated : 0,
    totalPnL: summaries.reduce((sum, item) => sum + item.totalPnL, 0),
    totalPnlPercentage: summaries.reduce((sum, item) => sum + item.totalPnlPercentage, 0),
    maxDrawdownUsd: Math.max(0, ...summaries.map((item) => item.maxDrawdownUsd)),
  };
}

async function evaluateConfig(params: DetectorHyperParams, fold: Fold, options: {
  stepHours: number;
  lookbackHours: number;
  horizonHours: number;
  sparseMaxDistanceMs: number;
}) {
  return replayCandidateBacktest({
    candidate: params,
    from: fold.validationFrom,
    to: fold.validationTo,
    stepHours: options.stepHours,
    lookbackHours: options.lookbackHours,
    horizonHours: options.horizonHours,
    feeRate: 0.001,
    slippageRate: 0.001,
    notionalUsd: 1000,
    sparseMaxDistanceMs: options.sparseMaxDistanceMs,
  });
}

async function main() {
  await connectToDatabase();

  const trainDays = readNumberArg("train-days", 21);
  const validationDays = readNumberArg("validation-days", 7);
  const foldCount = Math.floor(readNumberArg("folds", 3));
  const gridLimit = Math.floor(readNumberArg("grid-limit", 12));
  const horizonHours = readNumberArg("horizon-hours", 24);
  const stepHours = readNumberArg("step-hours", 24);
  const lookbackHours = readNumberArg("lookback-hours", 24);
  const sparseMaxDistanceMs = readNumberArg("sparse-max-distance-ms", 6 * 60 * 60 * 1000);
  const folds = buildFolds({ trainDays, validationDays, folds: foldCount });

  const run = await (backtestRunsTable as any).create({
    type: "WALK_FORWARD",
    status: "RUNNING",
    optimizer: "grid_search_walk_forward",
    trainWindow: { from: folds[0].trainFrom, to: folds[folds.length - 1].trainTo },
    validationWindow: {
      from: folds[0].validationFrom,
      to: folds[folds.length - 1].validationTo,
    },
    options: {
      trainDays,
      validationDays,
      foldCount,
      gridLimit,
      horizonHours,
      stepHours,
      lookbackHours,
      sparseMaxDistanceMs,
    },
    startedAt: new Date(),
  });

  try {
    const candidates = createDefaultHyperParamGrid().slice(0, gridLimit);
    const activeParams = await loadActiveHyperParams().catch(() => DEFAULT_HYPER_PARAMS);
    const candidateSummaries = [];

    for (const [candidateIndex, candidate] of candidates.entries()) {
      console.log(`[WalkForward] Candidate ${candidateIndex + 1}/${candidates.length}`);
      const foldsForCandidate = [];

      for (const [foldIndex, fold] of folds.entries()) {
        console.log(`[WalkForward] Candidate ${candidateIndex + 1}, fold ${foldIndex + 1}/${folds.length}`);
        const summary = await replayCandidateBacktest({
          candidate,
          from: fold.trainFrom,
          to: fold.trainTo,
          stepHours,
          lookbackHours,
          horizonHours,
          feeRate: 0.001,
          slippageRate: 0.001,
          notionalUsd: 1000,
          sparseMaxDistanceMs,
        });

        const [candidateValidation, activeValidation] = await Promise.all([
          evaluateConfig(candidate, fold, { stepHours, lookbackHours, horizonHours, sparseMaxDistanceMs }),
          evaluateConfig(activeParams, fold, { stepHours, lookbackHours, horizonHours, sparseMaxDistanceMs }),
        ]);

        foldsForCandidate.push({
          foldIndex,
          fold,
          train: summary,
          validation: candidateValidation,
          activeValidation,
          trainObjective: scoreBacktestSummary(summary),
          validationObjective: scoreBacktestSummary(candidateValidation),
        });
      }

      const validationAggregate = aggregateSummaries(
        foldsForCandidate.map((fold) => fold.validation)
      );
      const trainAggregate = aggregateSummaries(
        foldsForCandidate.map((fold) => fold.train)
      );
      const activeAggregate = aggregateSummaries(
        foldsForCandidate.map((fold) => fold.activeValidation)
      );
      const validationObjectives = foldsForCandidate.map((fold) => fold.validationObjective);
      const objectiveScore = median(validationObjectives);
      const promotable = guardrails(validationAggregate, activeAggregate);

      await (backtestCandidatesTable as any).create({
        runId: (run as any)._id,
        candidateIndex,
        params: candidate,
        trainMetrics: {
          aggregate: trainAggregate,
          folds: foldsForCandidate.map((fold) => ({
            foldIndex: fold.foldIndex,
            fold: fold.fold,
            summary: fold.train,
            objectiveScore: fold.trainObjective,
          })),
        },
        validationMetrics: {
          aggregate: validationAggregate,
          activeAggregate,
          medianObjectiveScore: objectiveScore,
          meanObjectiveScore: validationObjectives.length
            ? validationObjectives.reduce((sum, value) => sum + value, 0) / validationObjectives.length
            : Number.NEGATIVE_INFINITY,
          folds: foldsForCandidate.map((fold) => ({
            foldIndex: fold.foldIndex,
            fold: fold.fold,
            candidate: fold.validation,
            active: fold.activeValidation,
            objectiveScore: fold.validationObjective,
          })),
        },
        objectiveScore,
        status: promotable ? "CANDIDATE" : "REJECTED",
        promoted: false,
      });

      candidateSummaries.push({
        candidateIndex,
        candidate,
        trainAggregate,
        validationAggregate,
        activeAggregate,
        objectiveScore,
        promotable,
        folds: foldsForCandidate,
      });
    }

    const promotableCandidates = candidateSummaries.filter((candidate) => candidate.promotable);
    const bestCandidate = promotableCandidates.sort((a, b) => b.objectiveScore - a.objectiveScore)[0]
      ?? candidateSummaries.sort((a, b) => b.objectiveScore - a.objectiveScore)[0];
    const shouldPromote = Boolean(bestCandidate?.promotable && hasFlag("promote"));

    let savedConfigId: string | null = null;
    if (bestCandidate) {
      const saved = await saveCandidateConfig({
        name: "production",
        params: bestCandidate.candidate,
        metrics: {
          evaluated: bestCandidate.validationAggregate.evaluated,
          wins: bestCandidate.validationAggregate.wins,
          losses: bestCandidate.validationAggregate.losses,
          winRate: bestCandidate.validationAggregate.winRate,
          totalPnL: bestCandidate.validationAggregate.totalPnL,
          totalPnlPercentage: bestCandidate.validationAggregate.totalPnlPercentage,
          maxDrawdownUsd: bestCandidate.validationAggregate.maxDrawdownUsd,
          score: bestCandidate.objectiveScore,
        },
        trainWindow: { from: folds[0].trainFrom, to: folds[folds.length - 1].trainTo },
        validationWindow: {
          from: folds[0].validationFrom,
          to: folds[folds.length - 1].validationTo,
        },
        status: bestCandidate.promotable ? "CANDIDATE" : "REJECTED",
      });
      savedConfigId = String((saved as any)._id);

      if (shouldPromote) {
        await promoteCandidateConfig(savedConfigId);
      }
    }

    await backtestRunsTable.updateOne(
      { _id: (run as any)._id },
      {
        $set: {
          status: "COMPLETED",
          endedAt: new Date(),
          metrics: {
            folds: folds.length,
            candidates: candidateSummaries.length,
            promotableCandidates: promotableCandidates.length,
            bestObjectiveScore: bestCandidate?.objectiveScore ?? null,
            savedConfigId,
            promoted: shouldPromote,
            candidateSummaries,
          },
        },
      }
    );

    console.log(JSON.stringify({
      status: shouldPromote ? "PROMOTED" : bestCandidate?.promotable ? "CANDIDATE_READY" : "REJECTED_BY_PROMOTION_RULES",
      backtestRunId: String((run as any)._id),
      savedConfigId,
      folds: folds.length,
      candidates: candidateSummaries.length,
      promotableCandidates: promotableCandidates.length,
      best: bestCandidate ?? null,
    }, null, 2));
  } catch (error) {
    await backtestRunsTable.updateOne(
      { _id: (run as any)._id },
      {
        $set: {
          status: "FAILED",
          endedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      }
    );
    throw error;
  }
}

main()
  .catch((error) => {
    console.error("[WalkForward] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase().catch(async () => {
      await mongoose.disconnect().catch(() => undefined);
    });
  });
