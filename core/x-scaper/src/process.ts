import { XScraper } from "./scraper";
const X_EMAIL = process.env.X_SCRAPER_EMAIL || process.env.X_EMAIL;
const X_PASSWORD = process.env.X_SCRAPER_PASSWORD || process.env.X_PASSWORD;
const X_USERNAME = process.env.X_SCRAPER_USERNAME || process.env.X_USERNAME;

function readPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function isRetryableSeleniumStartupError(error: unknown): boolean {
  const message = error instanceof Error
    ? `${error.name}: ${error.message}\n${error.stack ?? ""}`
    : String(error);
  return /Server terminated early with status 127/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


/**
 * X（Twitter）
 * Đây là hàm entry point được gọi bởi Inngest/Cron Job.
 */
export async function processXScraping(options?: { specificAccountId?: string }): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  const startTime = new Date();

  // Kiểm tra credentials//login info
  if (!X_EMAIL || !X_PASSWORD || !X_USERNAME) {
      const msg = "X SCRAPER: Missing environment variables (X_EMAIL, X_PASSWORD, X_USERNAME).";
      console.error(msg);
      return { success: false, message: msg };
  }

  try {
    console.log(`[${startTime.toISOString()}] Starting X scraping process.`);

    // 1. Khởi tạo Scraper với Credentials
    const credentials = {
      email: X_EMAIL,
      password: X_PASSWORD,
      username: X_USERNAME,
    };
    
    // 2. Xử lý Scrape theo yêu cầu
    if (options?.specificAccountId) {
      console.log(`Scraping specific account: ${options.specificAccountId}`);

      try {
        const scraper = new XScraper(credentials);
        const result = await scraper.checkSingleAccount(options.specificAccountId); 
        const message = result 
            ? `Scraping for ${options.specificAccountId} completed. New tweets found.` 
            : `Scraping for ${options.specificAccountId} completed. No new tweets.`;

        return {
          success: true,
          message: message,
          data: { accountId: options.specificAccountId, latestTimestamp: result },
        };
      } catch (error) {
         return {
          success: false,
          message: `Scraping failed for ${options.specificAccountId}: ${String(error)}`,
          data: { error: String(error) },
         };
      }
    }

    // Trường hợp quét TẤT CẢ các tài khoản
    console.log(`Starting batch scraping for all registered X accounts.`);
    
    // checkXAccounts sẽ tự quản lý driver lifecycle cho từng tài khoản.
    const maxRetries = readPositiveIntEnv("X_SCRAPER_STARTUP_RETRIES", 2);
    const retryDelayMs = readPositiveIntEnv("X_SCRAPER_STARTUP_RETRY_DELAY_MS", 5000);
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const scraper = new XScraper(credentials);
        const { processed, success } = await scraper.checkXAccounts();

        return {
          success: true,
          message: `Batch scraping completed. Processed ${processed} accounts, found new tweets in ${success} accounts.`,
          data: { processed, success, startupRetryAttempts: attempt }
        };
      } catch (error) {
        lastError = error;
        if (!isRetryableSeleniumStartupError(error) || attempt >= maxRetries) {
          throw error;
        }

        const retryNumber = attempt + 1;
        console.warn(
          `[XScraper] Selenium startup failed with status 127. Retrying ${retryNumber}/${maxRetries} after ${retryDelayMs}ms...`
        );
        await sleep(retryDelayMs);
      }
    }

    throw lastError;
  } catch (error) {
    console.error("X scraping process encountered a critical error:", error);
    return {
      success: false,
      message: `Critical failure in X scraping process: ${String(error)}`,
      data: { error: String(error) },
    };
  }
}
