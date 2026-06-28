import "dotenv/config";
import mongoose from "mongoose";
import { getCurrentRegime, persistCurrentRegime } from "../services/regime-service.js";

function readNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  const parsed = raw ? Number(raw.slice(prefix.length)) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(): Promise<number> {
  try {
    const regime = await getCurrentRegime({
      windowHours: readNumberArg("window-hours", 24),
      maxAgeHours: readNumberArg("max-age-hours", 48),
      minSampleCount: readNumberArg(
        "min-sample-count",
        Number(process.env.REGIME_MIN_SAMPLE_COUNT ?? 20)
      ),
    });
    await persistCurrentRegime(regime);
    console.log(JSON.stringify({ status: "COMPLETED", ...regime }, null, 2));
    return 0;
  } finally {
    await mongoose.disconnect();
  }
}

main().then((code) => process.exit(code)).catch(async (error) => {
  console.error("[Regime] Failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
