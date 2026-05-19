import {
  DEFAULT_HYPER_PARAMS,
  DetectorHyperParams,
  resolveHyperParams,
} from "../types.js";

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

async function getShared() {
  return import("../../../shared/src/index.js") as any;
}

export async function loadActiveHyperParams(
  name = "production"
): Promise<DetectorHyperParams> {
  try {
    const { connectToDatabase, hyperparameterConfigsTable } = await getShared();
    await connectToDatabase();

    const active = await hyperparameterConfigsTable
      .findOne({ name, status: "ACTIVE" })
      .sort({ promotedAt: -1, updatedAt: -1 })
      .lean();

    return resolveHyperParams(active?.params ?? DEFAULT_HYPER_PARAMS);
  } catch (error) {
    console.warn(
      "[HyperParamConfigService] Falling back to DEFAULT_HYPER_PARAMS:",
      error instanceof Error ? error.message : String(error)
    );
    return DEFAULT_HYPER_PARAMS;
  }
}

export async function saveCandidateConfig(input: SaveCandidateConfigInput) {
  const { connectToDatabase, hyperparameterConfigsTable } = await getShared();
  await connectToDatabase();

  return hyperparameterConfigsTable.create({
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
  const { connectToDatabase, hyperparameterConfigsTable } = await getShared();
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
