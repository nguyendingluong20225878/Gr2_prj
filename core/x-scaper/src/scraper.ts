import fs from "fs";
import path from "path";

import { Logger, LogLevel } from "../../shared/src";
import {
  Builder,
  By,
  Key,
  until,
  WebDriver,
  WebElement,
  IWebDriverOptionsCookie as SeleniumCookie,
} from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";

import { getAllXAccounts, saveTweets } from "./db";
import {
  X_BASE_URL,
  TWEET_ARTICLE_SELECTOR_CSS,
  TIME_SELECTOR_CSS,
  REPLY_COUNT_SELECTOR_CSS,
  RETWEET_COUNT_SELECTOR_CSS,
  LIKE_COUNT_SELECTOR_CSS,
  TWEET_TEXT_SELECTOR_CSS,
  TWEET_LINK_SELECTOR,
  PRIMARY_COLUMN_SELECTOR_CSS,
  MAX_TWEETS_TO_PROCESS_PER_ACCOUNT,
} from "./constant";

/* ======================= TYPES ======================= */

interface Credentials {
  email: string;
  password: string;
  username: string;
}

interface Tweet {
  time: string; // ISO String
  data: string;
  url: string;
  replyCount: number | null;
  retweetCount: number | null;
  likeCount: number | null;
  impressionsCount: number | null;
}

/* ======================= UTILS ======================= */

function parseEngagementCount(text: string | null): number | null {
  if (!text) return null;
  const clean = text.replace(/,/g, "").toUpperCase();
  const num = parseFloat(clean);
  if (Number.isNaN(num)) return null;
  if (clean.includes("K")) return Math.round(num * 1_000);
  if (clean.includes("M")) return Math.round(num * 1_000_000);
  return num;
}

/* ======================= SCRAPER ======================= */

export class XScraper {
  private driver: WebDriver | null = null;
  private credentials: Credentials;
  private logger = new Logger({ level: LogLevel.INFO });

  // Tăng giới hạn an toàn để tránh vòng lặp vô tận nếu logic so sánh ngày bị lỗi
  private readonly SAFETY_LIMIT = 50; 

  constructor(credentials: Credentials) {
    this.credentials = credentials;
  }

  /* ======================= COOKIES ======================= */

  private getCookiesFilePath(): string {
    const rootDir = path.resolve(__dirname, "../../x-scaper");
    const dir = path.join(rootDir, "cookies");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "x-scraper_cookies.json");
  }

  private loadCookies(): any[] | null {
    const filePath = this.getCookiesFilePath();
    this.logger.info("loadCookies", `Đang kiểm tra file cookie tại: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      this.logger.error("loadCookies", "KHÔNG TÌM THẤY FILE COOKIE.");
      return null;
    }
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return data;
    } catch (e) {
      this.logger.error("loadCookies", "Lỗi đọc file JSON cookie.");
      return null;
    }
  }

  /* ======================= DRIVER ======================= */

  private async initDriver(cookies?: any[]): Promise<void> {
    const options = new chrome.Options();
    options.addArguments(
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );

    options.excludeSwitches("enable-automation");
    options.setUserPreferences({ "useAutomationExtension": false });

    this.driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

    await this.driver.executeScript(
      "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    );

    if (cookies?.length) {
      this.logger.info("initDriver", "Đang nạp Cookie...");
      await this.driver.get(X_BASE_URL);
      for (const cookie of cookies) {
        try {
          const seleniumCookie = {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || "/",
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expiry: cookie.expirationDate ? Math.floor(cookie.expirationDate) : undefined
          };
          await this.driver.manage().addCookie(seleniumCookie as SeleniumCookie);
        } catch (e) { /* ignore */ }
      }
    }
  }

  public async ensureLoggedIn(): Promise<boolean> {
    const cookies = this.loadCookies();
    if (!cookies) return false;

    await this.initDriver(cookies);
    
    try {
      this.logger.info("ensureLoggedIn", "Kiểm tra session...");
      await this.driver!.get(`${X_BASE_URL}/home`);
      await this.driver!.wait(until.elementLocated(By.css(PRIMARY_COLUMN_SELECTOR_CSS)), 15000);
      this.logger.info("ensureLoggedIn", "Login OK.");
      return true;
    } catch (e) {
      this.logger.error("ensureLoggedIn", "Cookie hết hạn.");
      await this.closeDriver();
      return false;
    }
  }

  private async closeDriver(): Promise<void> {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
    }
  }

  /* ======================= SCRAPE LOGIC (UPDATED) ======================= */

  /**
   * Hàm này sẽ cuộn trang và thu thập tweet.
   * - Nếu có `cutoffDate`: Sẽ dừng khi gặp tweet CŨ HƠN cutoffDate.
   * - Nếu không có `cutoffDate`: Sẽ lấy tối đa `SAFETY_LIMIT` tweet.
   */
  public async extractTweets(driver: WebDriver, cutoffDate: Date | null): Promise<Tweet[]> {
    // Map để lọc trùng lặp ngay trong quá trình scroll (key: tweetUrl hoặc text)
    const tweetsMap = new Map<string, Tweet>();
    let consecutiveOldTweets = 0; // Đếm số tweet cũ liên tiếp (để tránh dừng oan do Pinned Tweet)
    
    this.logger.info("extractTweets", `Bắt đầu cào. Cutoff Date: ${cutoffDate?.toISOString() ?? "NONE"}`);

    try {
      await driver.wait(until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)), 15000);

      let previousHeight = 0;
      let attempts = 0;

      while (tweetsMap.size < this.SAFETY_LIMIT) {
        // 1. Lấy tất cả các thẻ article đang hiện trên màn hình
        const articles = await driver.findElements(By.css(TWEET_ARTICLE_SELECTOR_CSS));

        // 2. Parse dữ liệu từng bài
        for (const el of articles) {
          try {
            // -- Lấy Text --
            let text = "";
            const nodes = await el.findElements(By.css(TWEET_TEXT_SELECTOR_CSS));
            for (const node of nodes) text += await node.getText();

            // -- Lấy Time --
            const timeElem = await el.findElement(By.css(TIME_SELECTOR_CSS));
            const tweetTimeStr = await timeElem.getAttribute("datetime");
            if (!tweetTimeStr) continue;

            const tweetDate = new Date(tweetTimeStr);

            // -- Logic Dừng (Stop Logic) --
            if (cutoffDate) {
              if (tweetDate <= cutoffDate) {
                consecutiveOldTweets++;
                // Nếu gặp 2 tweet cũ liên tiếp, ta tin rằng đã đến vùng dữ liệu cũ
                // (2 để tránh trường hợp tweet đầu tiên là Pinned Tweet rất cũ)
                if (consecutiveOldTweets >= 2) {
                   this.logger.info("extractTweets", "Đã gặp tweet cũ hơn lần cập nhật trước -> Dừng cào.");
                   // Break khỏi vòng lặp for, và return luôn
                   return Array.from(tweetsMap.values());
                }
                // Nếu mới gặp 1 tweet cũ (có thể là pinned), ta chưa add vào map vội, hoặc add cũng được nhưng chưa dừng.
              } else {
                // Nếu gặp tweet mới hơn cutoff -> Reset biến đếm cũ
                consecutiveOldTweets = 0;
              }
            }

            // -- Lấy Engagement --
            let replyCount = null, retweetCount = null, likeCount = null;
            try {
               const t = await el.findElement(By.css(REPLY_COUNT_SELECTOR_CSS)).getText();
               replyCount = parseEngagementCount(t);
            } catch {}
            try {
               const t = await el.findElement(By.css(RETWEET_COUNT_SELECTOR_CSS)).getText();
               retweetCount = parseEngagementCount(t);
            } catch {}
            try {
               const t = await el.findElement(By.css(LIKE_COUNT_SELECTOR_CSS)).getText();
               likeCount = parseEngagementCount(t);
            } catch {}

            // -- Lấy URL --
            let tweetUrl = "unknown";
            try {
                const linkElem = await el.findElement(By.css(TWEET_LINK_SELECTOR));
                const href = await linkElem.getAttribute("href");
                if (href) tweetUrl = href.startsWith("http") ? href : `https://x.com${href}`;
            } catch {}

            // Chỉ lưu nếu tweet URL chưa tồn tại trong Map (tránh trùng do scroll)
            // Và (quan trọng): Chỉ lưu nếu tweet này MỚI HƠN cutoffDate (nếu có)
            const isNew = cutoffDate ? tweetDate > cutoffDate : true;

            if (tweetUrl !== "unknown" && !tweetsMap.has(tweetUrl) && isNew) {
               tweetsMap.set(tweetUrl, {
                time: tweetTimeStr,
                data: text.trim(),
                url: tweetUrl,
                replyCount,
                retweetCount,
                likeCount,
                impressionsCount: null,
              });
            }
          } catch (err) {
            // Bỏ qua lỗi parse element lẻ tẻ
            continue;
          }
        }

        // 3. Scroll xuống cuối trang
        await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
        
        // 4. Chờ load
        await driver.sleep(2000);

        // 5. Kiểm tra xem đã hết trang chưa
        const currentHeight = await driver.executeScript("return document.body.scrollHeight") as number;
        if (currentHeight === previousHeight) {
            attempts++;
            if (attempts >= 3) break; // Thử 3 lần mà không load thêm được gì -> Hết trang
        } else {
            previousHeight = currentHeight;
            attempts = 0;
        }
      }
    } catch (e) {
      this.logger.warn("extractTweets", `Lỗi trong quá trình cào: ${e}`);
    }

    return Array.from(tweetsMap.values());
  }

  // Cập nhật hàm này để nhận tham số cutoffDate
  public async checkSingleAccount(
    xId: string, 
    closeDriverAfter: boolean = true,
    cutoffDate: Date | null = null 
  ): Promise<Date | null> {

    if (!this.driver) {
      const ok = await this.ensureLoggedIn();
      if (!ok) return null;
    }

    try {
      this.logger.info("checkSingleAccount", `Truy cập profile: ${xId}`);
      await this.driver!.get(`${X_BASE_URL}/${xId}`);
      await this.driver!.sleep(3000); // Chờ load ban đầu

      // Gọi hàm extract với cutoffDate
      const extracted = await this.extractTweets(this.driver!, cutoffDate);
      
      this.logger.info(
        "checkSingleAccount",
        `Đã tìm thấy ${extracted.length} tweets MỚI từ ${xId}`
      );

      if (extracted.length > 0) {
        const newest = await saveTweets(xId, extracted);
        return newest;
      }

      return null;
    } catch (error) {
      this.logger.error(
        "checkSingleAccount",
        `Lỗi khi xử lý account ${xId}: ${String(error)}`
      );
      return null;
    } finally {
      if (closeDriverAfter) {
        await this.closeDriver();
      }
    }
  }

  public async checkXAccounts(): Promise<{ processed: number; success: number }> {
    const accounts = await getAllXAccounts();
    this.logger.info("checkXAccounts", `Tìm thấy ${accounts.length} account trong DB cần scan.`);
    
    let processed = 0, success = 0;
    
    // Mở browser 1 lần dùng cho tất cả
    if (!this.driver) {
        const ok = await this.ensureLoggedIn();
        if (!ok) return { processed: 0, success: 0 };
    }

    for (const acc of accounts) {
      // Truyền lastTweetUpdatedAt vào làm mốc thời gian chặn
      // acc.lastTweetUpdatedAt lấy từ DB (trong db.ts bạn đã map nó rồi)
      const lastUpdate = acc.lastTweetUpdatedAt ? new Date(acc.lastTweetUpdatedAt) : null;
      
      // Pass 'false' để không đóng driver sau mỗi acc
      const ts = await this.checkSingleAccount(acc.id, false, lastUpdate);
      
      if (ts) success++;
      processed++;
      
      // Nghỉ ngắn giữa các account để tránh bị flag bot
      await this.driver?.sleep(2000);
    }

    await this.closeDriver();
    return { processed, success };
  }
}