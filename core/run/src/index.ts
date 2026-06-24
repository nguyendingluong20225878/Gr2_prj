import "dotenv/config";
import cron from "node-cron";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { Logger, connectToDatabase, mongoose } from "@gr2/shared";

/**
 * ⚠️ FIX CHO ESM:
 * __dirname / __filename không tồn tại trong ES module
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = new Logger("MasterCron");

/**
 * 🔒 LOCK để tránh cron chạy chồng (gây lỗi Selenium)
 */
let isRunning = false;
const LOCK_ID = "master-cron-pipeline";
const LOCK_TTL_MS = Number(process.env.PIPELINE_LOCK_TTL_MINUTES ?? 180) * 60 * 1000;
const CRON_EXPRESSION = process.env.PIPELINE_CRON ?? "0 8,20 * * *";
const CRON_TIMEZONE = process.env.PIPELINE_TIMEZONE ?? "Asia/Ho_Chi_Minh";
const RUN_ON_START = process.env.PIPELINE_RUN_ON_START === "true";
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";
const STEP_DELAY_MS = Math.max(0, Number(process.env.PIPELINE_STEP_DELAY_MS ?? 0));
const SHOULD_RUN_ONCE =
  process.argv.includes("--once") || process.env.PIPELINE_RUN_MODE === "once";

type JobLockDocument = {
  _id: string;
  owner?: string;
  lockedAt?: Date;
  releasedAt?: Date | null;
  ttlMs?: number;
};

async function acquirePipelineLock() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");

  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TTL_MS);
  const owner = `${process.pid}:${now.toISOString()}`;
  const locks = db.collection<JobLockDocument>("job_locks");
  const result = await locks.findOneAndUpdate(
    {
      _id: LOCK_ID,
      $or: [
        { lockedAt: { $lte: staleBefore } },
        { lockedAt: { $exists: false } },
        { releasedAt: { $ne: null } },
      ],
    },
    {
      $set: {
        owner,
        lockedAt: now,
        releasedAt: null,
        ttlMs: LOCK_TTL_MS,
      },
    },
    { returnDocument: "after" }
  );

  if (result?.owner === owner) return owner;

  try {
    await locks.insertOne({
      _id: LOCK_ID,
      owner,
      lockedAt: now,
      releasedAt: null,
      ttlMs: LOCK_TTL_MS,
    });
    return owner;
  } catch {
    return null;
  }
}

async function releasePipelineLock(owner: string) {
  const db = mongoose.connection.db;
  if (!db) return;
  await db.collection<JobLockDocument>("job_locks").updateOne(
    { _id: LOCK_ID, owner },
    { $set: { releasedAt: new Date() } }
  );
}

async function refreshPipelineLock(owner: string) {
  const db = mongoose.connection.db;
  if (!db) return;
  await db.collection<JobLockDocument>("job_locks").updateOne(
    { _id: LOCK_ID, owner, releasedAt: null },
    {
      $set: {
        lockedAt: new Date(),
        ttlMs: LOCK_TTL_MS,
      },
    }
  );
}

function runNpmStep(label: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    logger.info(`${label} bắt đầu: npm ${args.join(" ")}`);
    const startedAt = Date.now();
    const child = spawn(NPM_BIN, args, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: process.env,
      shell: false,
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      if (code === 0) {
        logger.info(`${label} hoàn thành trong ${seconds}s.`);
        resolve();
      } else {
        reject(new Error(`${label} thất bại với exit code ${code}.`));
      }
    });
  });
}

async function runOptionalNpmStep(label: string, args: string[]) {
  try {
    await runNpmStep(label, args);
  } catch (error) {
    logger.error(`${label} lỗi, pipeline vẫn tiếp tục bước sau.`, error);
  }
}

async function waitBetweenSteps() {
  if (!Number.isFinite(STEP_DELAY_MS) || STEP_DELAY_MS <= 0) return;
  logger.info(`Nghỉ ${(STEP_DELAY_MS / 1000).toFixed(0)}s trước bước tiếp theo...`);
  await new Promise((resolve) => setTimeout(resolve, STEP_DELAY_MS));
}

async function runPipelineStep(label: string, args: string[], options: { optional?: boolean } = {}) {
  if (options.optional) await runOptionalNpmStep(label, args);
  else await runNpmStep(label, args);
  await waitBetweenSteps();
}

async function runPipelineOnce(trigger: "cron" | "startup" = "cron") {
  logger.info(`Cron tick nhận được, trigger=${trigger}.`);
  if (isRunning) {
    logger.warn("Pipeline đang chạy, bỏ qua lần này.");
    return;
  }

  isRunning = true;
  const lockOwner = await acquirePipelineLock();
  if (!lockOwner) {
    logger.warn("Pipeline lock đang thuộc process khác, bỏ qua lần này.");
    isRunning = false;
    return;
  }

  let lockHeartbeat: ReturnType<typeof setInterval> | null = null;

  try {
    const heartbeatIntervalMs = Math.max(1_000, Math.floor(LOCK_TTL_MS / 3));
    lockHeartbeat = setInterval(() => {
      refreshPipelineLock(lockOwner).catch((error) => {
        logger.error("Không thể refresh pipeline lock:", error);
      });
    }, heartbeatIntervalMs);

    logger.info("=== BẮT ĐẦU PIPELINE TỰ ĐỘNG ===");
    const hasXCredentials = Boolean(
      process.env.X_EMAIL &&
      process.env.X_PASSWORD &&
      process.env.X_USERNAME
    );
    const shouldRunXScraper =
      process.env.RUN_X_SCRAPER === "true" ||
      (process.env.RUN_X_SCRAPER !== "false" && hasXCredentials);

    if (shouldRunXScraper) {
      await runPipelineStep("Bước 1: Cào dữ liệu từ X", ["run", "scraper"], { optional: true });
    } else {
      logger.warn("Bước 1 bỏ qua: X scraper chưa bật hoặc thiếu credential.");
    }

    await runPipelineStep("Bước 2: Cào dữ liệu News", ["run", "news"], { optional: true });
    await runPipelineStep("Bước 3: Backfill giá 1 ngày", ["run", "prices:backfill:1d"]);
    await runPipelineStep("Bước 4: Chấm outcome backtest 12h", ["run", "backtest:outcome"]);
    await runPipelineStep("Bước 5: Cập nhật rolling metrics", ["run", "metrics"]);
    await runPipelineStep("Bước 6: Xác định regime", ["run", "regime"]);
    await runPipelineStep("Bước 7: Cập nhật dynamic source weights", ["run", "weights"]);
    await runPipelineStep("Bước 8: Phát hiện tín hiệu Quant", ["run", "signal"]);
    await runPipelineStep("Bước 9: Tạo proposal Layer3", [
      "--workspace",
      "@gr2/layer3",
      "run",
      "layer3",
    ]);

    logger.info("=== PIPELINE HOÀN TẤT ===");
  } catch (error) {
    logger.error("Lỗi trong pipeline:", error);
  } finally {
    if (lockHeartbeat) clearInterval(lockHeartbeat);
    try {
      await releasePipelineLock(lockOwner);
    } catch (error) {
      logger.error("Không thể release pipeline lock:", error);
    } finally {
      isRunning = false;
    }
  }
}

async function start() {
  try {
    // 1. Kết nối DB
    await connectToDatabase();
    logger.info("Cơ sở dữ liệu đã kết nối. Bắt đầu thiết lập Cron Jobs...");

    if (SHOULD_RUN_ONCE) {
      logger.info("PIPELINE_RUN_MODE=once, chạy pipeline một lần rồi đóng process.");
      await runPipelineOnce("startup");
      await mongoose.connection.close();
      return;
    }

    // 2. Thiết lập Cron Job
    const task = cron.schedule(CRON_EXPRESSION, () => {
      void runPipelineOnce("cron");
    }, {
      timezone: CRON_TIMEZONE,
    });
    task.start();

    logger.info(`Tất cả Cron Jobs đã được lập lịch thành công: ${CRON_EXPRESSION}, timezone=${CRON_TIMEZONE}`);
    if (RUN_ON_START) {
      logger.info("PIPELINE_RUN_ON_START=true, chạy pipeline ngay sau khi khởi động scheduler.");
      setTimeout(() => {
        void runPipelineOnce("startup");
      }, 500);
    }
  } catch (error) {
    logger.error("Không thể khởi động MasterCron:", error);
    process.exit(1);
  }
}

// 3. Khởi động
start();
