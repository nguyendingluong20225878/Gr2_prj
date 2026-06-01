import "dotenv/config";
import {
  backtestCandidatesTable,
  backtestRunsTable,
  connectToDatabase,
  disconnectFromDatabase,
} from "@gr2/shared";
import {
  promoteCandidateConfig,
  saveCandidateConfig,
} from "../../signal-detector/src/index.js";
import {
  createDefaultHyperParamGrid,
  rankHyperParamResults,
} from "./hyperparameter-grid.js";
import { replayCandidateBacktest } from "./replay-engine.js";

let activeRunId: unknown = null;

function readNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;

  const value = Number(raw.slice(prefix.length));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function canPromote(result: {
  evaluated: number;
  winRate: number;
  totalPnL: number;
  maxDrawdownUsd: number;
}) {
  return (
    result.evaluated >= 50 &&
    result.totalPnL > 0 &&
    result.winRate >= 0.45 &&
    result.maxDrawdownUsd <= Math.max(result.totalPnL * 2, 100)
  );
}

async function main() {
  await connectToDatabase();

  const trainDays = readNumberArg("train-days", 21);
  const validationDays = readNumberArg("validation-days", 7);
  const gridLimit = Math.floor(readNumberArg("grid-limit", 10));
  const horizonHours = readNumberArg("horizon-hours", 24);
  const stepHours = readNumberArg("step-hours", 24);
  const lookbackHours = readNumberArg("lookback-hours", 24);
  const sparseMaxDistanceMs = readNumberArg(
    "sparse-max-distance-ms",
    6 * 60 * 60 * 1000
  );

  const validationTo = new Date();
  const validationFrom = daysAgo(validationDays);
  const trainTo = validationFrom;
  const trainFrom = daysAgo(trainDays + validationDays);
  const startedAt = new Date();
  const run = await backtestRunsTable.create({
    type: "HYPERPARAM_OPTIMIZATION",
    status: "RUNNING",
    optimizer: "grid_search",
    trainWindow: { from: trainFrom, to: trainTo },
    validationWindow: { from: validationFrom, to: validationTo },
    options: {
      trainDays,
      validationDays,
      gridLimit,
      horizonHours,
      stepHours,
      lookbackHours,
      sparseMaxDistanceMs,
      feeRate: 0.001,
      slippageRate: 0.001,
      notionalUsd: 1000,
    },
    startedAt,
  });
  activeRunId = (run as any)._id;

  const candidates = createDefaultHyperParamGrid().slice(0, gridLimit);
  const trainResults = [];

  for (const [index, candidate] of candidates.entries()) {
    const candidateStartedAt = Date.now();
    console.log(`[Optimizer] Candidate ${index + 1}/${candidates.length}`);
    const summary = await replayCandidateBacktest({
      candidate,
      from: trainFrom,
      to: trainTo,
      stepHours,
      lookbackHours,
      horizonHours,
      feeRate: 0.001,
      slippageRate: 0.001,
      notionalUsd: 1000,
      sparseMaxDistanceMs,
    });

    trainResults.push({ candidate, summary });
    const objectiveScore = rankHyperParamResults([{ candidate, summary }])[0]
      ?.objectiveScore ?? Number.NEGATIVE_INFINITY;
    await backtestCandidatesTable.create({
      runId: (run as any)._id,
      candidateIndex: index,
      params: candidate,
      trainMetrics: {
        ...summary,
        latencyMs: Date.now() - candidateStartedAt,
      },
      objectiveScore,
      status: "TRAINED",
    });
  }

  const ranked = rankHyperParamResults(trainResults);
  const best = ranked[0];
  if (!best) {
    await backtestRunsTable.updateOne(
      { _id: (run as any)._id },
      {
        $set: {
          status: "COMPLETED",
          endedAt: new Date(),
          metrics: { testedCandidates: 0 },
        },
      }
    );
    console.log(JSON.stringify({ status: "NO_CANDIDATES" }, null, 2));
    return;
  }

  const validation = await replayCandidateBacktest({
    candidate: best.candidate,
    from: validationFrom,
    to: validationTo,
    stepHours,
    lookbackHours,
    horizonHours,
    feeRate: 0.001,
    slippageRate: 0.001,
    notionalUsd: 1000,
    sparseMaxDistanceMs,
  });

  const promotable = canPromote(validation);
  await backtestCandidatesTable.updateOne(
    {
      runId: (run as any)._id,
      candidateIndex: candidates.findIndex(
        (candidate) => JSON.stringify(candidate) === JSON.stringify(best.candidate)
      ),
    },
    {
      $set: {
        validationMetrics: validation,
        objectiveScore: best.objectiveScore,
        status: promotable ? "CANDIDATE" : "REJECTED",
        promoted: promotable && hasFlag("promote"),
      },
    }
  );

  const saved = await saveCandidateConfig({
    name: "production",
    params: best.candidate,
    metrics: {
      evaluated: validation.evaluated,
      wins: validation.wins,
      losses: validation.losses,
      winRate: validation.winRate,
      totalPnL: validation.totalPnL,
      totalPnlPercentage: validation.totalPnlPercentage,
      maxDrawdownUsd: validation.maxDrawdownUsd,
      score: best.objectiveScore,
    },
    trainWindow: { from: trainFrom, to: trainTo },
    validationWindow: { from: validationFrom, to: validationTo },
    status: promotable ? "CANDIDATE" : "REJECTED",
  });

  if (promotable && hasFlag("promote")) {
    await promoteCandidateConfig(String((saved as any)._id));
  }

  await backtestRunsTable.updateOne(
    { _id: (run as any)._id },
    {
      $set: {
        status: "COMPLETED",
        endedAt: new Date(),
        metrics: {
          testedCandidates: candidates.length,
          bestObjectiveScore: best.objectiveScore,
          validation,
          savedConfigId: String((saved as any)._id),
          promoted: promotable && hasFlag("promote"),
        },
      },
    }
  );

  console.log(JSON.stringify({
    status: promotable
      ? hasFlag("promote")
        ? "PROMOTED"
        : "CANDIDATE_READY"
      : "REJECTED_BY_PROMOTION_RULES",
    trainWindow: { from: trainFrom, to: trainTo },
    validationWindow: { from: validationFrom, to: validationTo },
    testedCandidates: candidates.length,
    bestTrain: best,
    validation,
    savedConfigId: String((saved as any)._id),
    backtestRunId: String((run as any)._id),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("Hyperparameter optimization failed:", error);
    if (activeRunId) {
      void backtestRunsTable
        .updateOne(
        { _id: activeRunId },
        {
          $set: {
            status: "FAILED",
            endedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        }
      )
        .catch(() => undefined);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });
