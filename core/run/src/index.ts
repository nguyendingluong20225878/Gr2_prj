import "dotenv/config";
import cron from "node-cron";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

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

async function start() {
  try {
    // 1. Kết nối DB
    await connectToDatabase();
    logger.info("Cơ sở dữ liệu đã kết nối. Bắt đầu thiết lập Cron Jobs...");

    // 2. Thiết lập Cron Job
    cron.schedule("*/1 * * * *", async () => {
      if (isRunning) {
        logger.warn("Pipeline đang chạy, bỏ qua lần này.");
        return;
      }

      isRunning = true;

      try {
        // logger.info("=== BẮT ĐẦU PIPELINE TỰ ĐỘNG ===");
        // logger.info("Bước 1: Cào dữ liệu từ X...");

        // const scraperPath = path.resolve(
        //   __dirname,
        //   "../../x-scaper/scripts/run-scraper.ts"
        // );

        // execSync(`npx tsx ${scraperPath}`, {
        //   stdio: "inherit",
        //   env: process.env, // 🔥 truyền .env từ core/run xuống x-scaper
        // });

        // logger.info("Bước 1 hoàn thành: Cào dữ liệu từ X.");
          // Bước 2: Phát hiện tín hiệu
          logger.info("Bước 2: Phát hiện tín hiệu...");
          const signalDetectorPath = path.resolve(
            __dirname,
            "../../signal-detector/scripts/run-detection.ts"
          );
          execSync(`npx tsx ${signalDetectorPath}`, {
            stdio: "inherit",
            env: process.env,
          });
          logger.info("Bước 2 hoàn thành: Phát hiện tín hiệu.");

          // Bước 3: Tạo proposal
          logger.info("Bước 3: Tạo proposal...");
          const proposalGeneratorPath = path.resolve(
            __dirname,
            "../../proposal-generator/scripts/generateProposal.ts"
          );
          execSync(`npx tsx ${proposalGeneratorPath}`, {
            stdio: "inherit",
            env: process.env,
          });
          logger.info("Bước 3 hoàn thành: Tạo proposal.");
        logger.info("=== PIPELINE HOÀN TẤT ===");
      } catch (error) {
        logger.error("Lỗi trong pipeline:", error);
      } finally {
        isRunning = false;
      }
    });

    logger.info("Tất cả Cron Jobs đã được lập lịch thành công.");
  } catch (error) {
    logger.error("Không thể khởi động MasterCron:", error);
    process.exit(1);
  }
}

// 3. Khởi động
start();
