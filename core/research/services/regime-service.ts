import {
  connectToDatabase,
  rollingMetricsTable,
  type MarketRegime,
} from "../../shared/src/index.js";

export async function getCurrentRegime(options: {
  windowHours?: number;
  maxAgeHours?: number;
} = {}): Promise<{
  regime: MarketRegime | "mixed";
  confidence: number;
  sampleCount: number;
  asOf: Date | null;
  reason: string;
}> {
  await connectToDatabase();
  const windowHours = options.windowHours ?? 24;
  const minAsOf = new Date(Date.now() - (options.maxAgeHours ?? windowHours * 2) * 60 * 60 * 1000);
  const rows = await rollingMetricsTable
    .find({ windowHours, asOf: { $gte: minAsOf } })
    .sort({ asOf: -1 })
    .limit(100)
    .lean();

  if (rows.length === 0) {
    return {
      regime: "mixed",
      confidence: 0,
      sampleCount: 0,
      asOf: null,
      reason: "No fresh rolling_metrics rows; fallback mixed.",
    };
  }

  const latestAsOf = new Date((rows[0] as any).asOf);
  const latest = (rows as any[]).filter((row) => new Date(row.asOf).getTime() === latestAsOf.getTime());
  const counts = new Map<string, number>();
  for (const row of latest) {
    const regime = String(row.marketRegime ?? "mixed");
    counts.set(regime, (counts.get(regime) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [regime, count] = ranked[0] ?? ["mixed", 0];

  return {
    regime: regime as MarketRegime,
    confidence: latest.length ? count / latest.length : 0,
    sampleCount: latest.length,
    asOf: latestAsOf,
    reason: `Rule-based regime from latest ${windowHours}h rolling_metrics.`,
  };
}
