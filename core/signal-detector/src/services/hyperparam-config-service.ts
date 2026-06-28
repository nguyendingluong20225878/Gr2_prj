import {
  DEFAULT_HYPER_PARAMS,
  DetectorHyperParams,
  resolveHyperParams,
} from "../types.js";
import {
  connectToDatabase,
  hyperparameterConfigsTable,
} from "@gr2/shared";

export type HyperParamConfigMetrics = {
  evaluated: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  totalPnlPercentage: number;
  maxDrawdownUsd: number;
  score: number;
};

export type SaveCandidateConfigInput = {
  name: string;
  params: DetectorHyperParams;
  metrics: HyperParamConfigMetrics;
  trainWindow: { from: Date; to: Date };
  validationWindow?: { from: Date; to: Date };
  status?: "CANDIDATE" | "REJECTED";
};

function readPositiveEnvNumber(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function applyEnvOverrides(params: DetectorHyperParams): DetectorHyperParams {
  return resolveHyperParams({
    ...params,
    signalThreshold: readPositiveEnvNumber("SIGNAL_THRESHOLD") ?? params.signalThreshold,
    actionThreshold: readPositiveEnvNumber("ACTION_THRESHOLD") ?? params.actionThreshold,
    holdSignalThreshold: readPositiveEnvNumber("HOLD_SIGNAL_THRESHOLD") ?? params.holdSignalThreshold,
    maxAbsSignalScore: readPositiveEnvNumber("MAX_ABS_SIGNAL_SCORE") ?? params.maxAbsSignalScore,
  });
}

export async function loadActiveHyperParams(
  name = "production"
): Promise<DetectorHyperParams> {
  try {
    await connectToDatabase();

    const active = await hyperparameterConfigsTable
      .findOne({ name, status: "ACTIVE" })
      .sort({ promotedAt: -1, updatedAt: -1 })
      .lean();

    return applyEnvOverrides(resolveHyperParams(active?.params ?? DEFAULT_HYPER_PARAMS));
  } catch (error) {
    console.warn(
      "[HyperParamConfigService] Falling back to DEFAULT_HYPER_PARAMS:",
      error instanceof Error ? error.message : String(error)
    );
    return applyEnvOverrides(DEFAULT_HYPER_PARAMS);
  }
}

export async function saveCandidateConfig(input: SaveCandidateConfigInput) {
  await connectToDatabase();

  return (hyperparameterConfigsTable as any).create({
    name: input.name,
    status: input.status ?? "CANDIDATE",
    params: input.params,
    metrics: input.metrics,
    trainWindow: input.trainWindow,
    validationWindow: input.validationWindow ?? {},
    promotedAt: null,
  });
}

export async function promoteCandidateConfig(candidateId: string) {
  await connectToDatabase();

  const candidate = await hyperparameterConfigsTable.findById(candidateId);
  if (!candidate) {
    throw new Error(`Candidate hyperparameter config not found: ${candidateId}`);
  }

  await hyperparameterConfigsTable.updateMany(
    { name: candidate.name, status: "ACTIVE" },
    { $set: { status: "ARCHIVED" } }
  );

  candidate.status = "ACTIVE";
  candidate.promotedAt = new Date();
  await candidate.save();

  return candidate;
}
