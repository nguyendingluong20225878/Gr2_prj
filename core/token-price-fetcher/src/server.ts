import "dotenv/config";
import cron from "node-cron";//lập lịch
import { processTokenPrices } from "./process";

/**
* Tập lệnh để chạy trong môi trường cục bộ
* 1. Chế độ thực thi một lần
* 2. Chế độ thực thi CRON
* 3. Chế độ tìm kiếm mã thông báo cụ thể
*/
async function main() {
  console.log("=== cập nhật giá Jupiter ===");

  // Phân tích các đối số dòng lệnh
  const args = process.argv.slice(2);
  const isCronMode = args.includes("--cron");//có chạy cron không
  const tokenArg = args.find((arg) => arg.startsWith("--token="));
  const specificTokenAddress = tokenArg?.split("=")[1];

  // Chế độ tìm kiếm mã thông báo cụ thể
  if (specificTokenAddress) {
    console.log(`Chế độ tìm kiếm giá mã thông báo cụ thể`);
    const result = await processTokenPrices({ specificTokenAddress });
    console.log(result);
    process.exit(result.success ? 0 : 1);
  }

  // chế độ CRON
  if (isCronMode) {
    const cronExpression = process.env.PRICE_UPDATE_CRON || "*/30 * * * *"; 
    console.log(`chế độ CRON: ${cronExpression}`);

    cron.schedule(cronExpression, async () => {
      try {
        console.log(`\n[${new Date().toISOString()}] Thực thi CRON`);
        const result = await processTokenPrices();
        console.log(result);
      } catch (error) {
        console.error("Lỗi thực thi CRON:", error);
      }
    });

    console.log("Đang chạy nền... Nhấn Ctrl+C để dừng");
    return;
  }

  // Chế độ thực thi một lần (mặc định)
  console.log("Chế độ thực thi một lần");
  const result = await processTokenPrices();
  console.log(result);
  process.exit(result.success ? 0 : 1);
}

// Bắt đầu xử lý chính
main().catch((error) => {
  console.error("Đã xảy ra lỗi :", error);
  process.exit(1);
});
