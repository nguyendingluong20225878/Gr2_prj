import dotenv from "dotenv";
import path from "path";

const primary = dotenv.config();
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

import { runBacktestUpdateSourceWeights, runBacktestUpdateSignalWeights } from "../src/backtestJob";

(async () => {
  console.log("Running backtest jobs...");
  const source = await runBacktestUpdateSourceWeights({
    horizonHours: Number(process.env.BT_HORIZON_HOURS ?? 24),
    windowDays: Number(process.env.BT_WINDOW_DAYS ?? 60),
    k: Number(process.env.BT_SITE_K ?? 1.0),
  });
  console.log("source_weights:", source);

  const sig = await runBacktestUpdateSignalWeights({
    horizonHours: Number(process.env.BT_HORIZON_HOURS ?? 24),
    windowDays: Number(process.env.BT_WINDOW_DAYS ?? 60),
    a: Number(process.env.BT_BLEND_A ?? 0.5),
  });
  console.log("signal_weights:", sig);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

