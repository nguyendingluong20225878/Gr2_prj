import "dotenv/config";
import mongoose from "mongoose";
import {
  backtestCandidatesTable,
  backtestRunsTable,
  connectToDatabase,
  rollingMetricsTable,
  signalsTable,
  sourceWeightsTable,
} from "../../shared/src/index.js";

function readNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  const parsed = raw ? Number(raw.slice(prefix.length)) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(): Promise<number> {
  await connectToDatabase();
  const rollingDays = readNumberArg(
    "rolling-days",
    Number(process.env.ROLLING_METRICS_RETENTION_DAYS ?? 7)
  );
  const backtestDays = readNumberArg("backtest-days", 180);
  const now = Date.now();

  await Promise.all([
    signalsTable.createIndexes(),
    rollingMetricsTable.createIndexes(),
    sourceWeightsTable.createIndexes(),
    backtestRunsTable.createIndexes(),
    backtestCandidatesTable.createIndexes(),
  ]);

  const rollingCutoff = new Date(now - rollingDays * 24 * 60 * 60 * 1000);
  const backtestCutoff = new Date(now - backtestDays * 24 * 60 * 60 * 1000);
  const [rollingDelete, candidateDelete, runDelete] = await Promise.all([
    rollingMetricsTable.deleteMany({ asOf: { $lt: rollingCutoff } }),
    (backtestCandidatesTable as any).deleteMany({ createdAt: { $lt: backtestCutoff }, promoted: { $ne: true } }),
    (backtestRunsTable as any).deleteMany({ createdAt: { $lt: backtestCutoff }, status: { $ne: "RUNNING" } }),
  ]);

  console.log(JSON.stringify({
    status: "COMPLETED",
    indexesSynced: true,
    deleted: {
      rollingMetrics: rollingDelete.deletedCount ?? 0,
      backtestCandidates: candidateDelete.deletedCount ?? 0,
      backtestRuns: runDelete.deletedCount ?? 0,
    },
  }, null, 2));

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch(async (error) => {
    console.error("[Maintenance] Failed:", error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
