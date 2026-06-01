import "dotenv/config";
import cron from "node-cron";
import { execSync, spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import mongoose from "mongoose";

import { Logger, connectToDatabase } from "@gr2/shared";

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
const LOCK_TTL_MS = 10 * 60 * 1000;
const CRON_EXPRESSION = process.env.PIPELINE_CRON ?? "0 8,20 * * *";

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

async function start() {
  try {
    // 1. Kết nối DB
    await connectToDatabase();
    logger.info("Cơ sở dữ liệu đã kết nối. Bắt đầu thiết lập Cron Jobs...");

    // 2. Thiết lập Cron Job
    cron.schedule(CRON_EXPRESSION, async () => {
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
          try {
            logger.info("Bước 1: Cào dữ liệu từ X...");
            const scraperPath = path.resolve(
              __dirname,
              "../../x-scaper/scripts/run-scraper.ts"
            );

            execSync(`npx tsx ${scraperPath}`, {
              stdio: "inherit",
              env: process.env,
            });

            logger.info("Bước 1 hoàn thành: Cào dữ liệu từ X.");
          } catch (error) {
            logger.error("Bước 1 lỗi: X scraper thất bại, tiếp tục chạy quant/Layer3.", error);
          }
        } else {
          logger.warn("Bước 1 bỏ qua: X scraper chưa bật hoặc thiếu credential.");
        }

          // Bước 2: Cập nhật rolling metrics/regime trước khi Quant dùng dynamic beta.
          logger.info("Bước 2: Cập nhật rolling metrics...");
          const rollingMetricsPath = path.resolve(
            __dirname,
            "../../research/jobs/run-rolling-metrics.ts"
          );
          execSync(`npx tsx ${rollingMetricsPath}`, {
            stdio: "inherit",
            env: process.env,
          });
          logger.info("Bước 2 hoàn thành: rolling metrics đã cập nhật.");

          // Bước 3: Cập nhật source weights theo rolling IC. Chạy nhẹ, có lock riêng.
          logger.info("Bước 3: Cập nhật dynamic source weights...");
          const dynamicWeightPath = path.resolve(
            __dirname,
            "../../research/jobs/run-dynamic-weight.ts"
          );
          execSync(`npx tsx ${dynamicWeightPath}`, {
            stdio: "inherit",
            env: process.env,
          });
          logger.info("Bước 3 hoàn thành: dynamic source weights đã cập nhật.");

          // Bước 4: Phát hiện tín hiệu
          logger.info("Bước 4: Phát hiện tín hiệu...");
          const signalDetectorPath = path.resolve(
            __dirname,
            "../../signal-detector/scripts/run-quant.ts"
          );
          execSync(`npx tsx ${signalDetectorPath}`, {
            stdio: "inherit",
            env: process.env,
          });
          logger.info("Bước 4 hoàn thành: Phát hiện tín hiệu.");

          // Bước 5: Tạo proposal async để Quant signal xuất hiện trước Layer3.
          logger.info("Bước 5: Tạo proposal async...");
          const layer3Limit = Number(process.env.LAYER3_BATCH_LIMIT ?? 3);
          const proposalGeneratorPath = path.resolve(
            __dirname,
            "../../layer3/scripts/run-layer3.ts"
          );
          const layer3Process = spawn(
            "npx",
            [
              "tsx",
              proposalGeneratorPath,
              `--limit=${Number.isFinite(layer3Limit) && layer3Limit > 0 ? Math.floor(layer3Limit) : 3}`,
            ],
            {
              stdio: "inherit",
              env: process.env,
              detached: false,
            }
          );
          layer3Process.on("error", (error) => {
            logger.error("Layer3 async process failed to start:", error);
          });
          layer3Process.on("exit", (code) => {
            if (code === 0) logger.info("Layer3 async process completed.");
            else logger.warn(`Layer3 async process exited with code=${code}.`);
          });
          logger.info("Bước 5 đã dispatch: Layer3 chạy nền, Quant signal đã sẵn sàng trước.");
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
    });

    logger.info(`Tất cả Cron Jobs đã được lập lịch thành công: ${CRON_EXPRESSION}`);
  } catch (error) {
    logger.error("Không thể khởi động MasterCron:", error);
    process.exit(1);
  }
}

// 3. Khởi động
start();
