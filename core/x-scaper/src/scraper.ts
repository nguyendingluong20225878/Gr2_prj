import fs from "fs";
import path from "path";
import { Builder, By, until, WebDriver, WebElement, IWebDriverOptionsCookie as SeleniumCookie } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";

// Import Logger từ shared
import { Logger } from "../../shared/src/utils/logger";
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
} from "./constant";

/* ======================= TYPES ======================= */
interface Credentials {
  email: string;
  password: string;
  username: string;
}

interface Tweet {
  time: string;
  data: string;
  url: string;
  username?: string; 
  replyCount?: number;
  retweetCount?: number;
  likeCount?: number;
  impressionsCount?: number;
}

/* ======================= UTILS ======================= */
function parseKMetric(text: string | null): number | null {
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
  
  // Refactor 1: Sử dụng Logger
  private logger = new Logger('XScraper');
  private readonly SAFETY_LIMIT = 50; 

  constructor(credentials: Credentials) {
    this.credentials = credentials;
  }

  /* -------Cookies và Init Driver-------------- */

  private getCookiesFilePath(): string {
    const rootDir = path.resolve(__dirname, "../../x-scaper");
    const dir = path.join(rootDir, "cookies");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "x-scraper_cookies.json");
  }

  private loadCookies(): any[] | null {
    const filePath = this.getCookiesFilePath();
    this.logger.info(`Đang kiểm tra file cookie tại: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      this.logger.warn("KHÔNG TÌM THẤY FILE COOKIE.");
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {
      this.logger.error("Lỗi đọc file JSON cookie.", e);
      return null;
    }
  }

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

    this.driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
    await this.driver.executeScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");

    if (cookies?.length) {
      this.logger.info("Đang nạp Cookie...");
      await this.driver.get(X_BASE_URL);
      for (const cookie of cookies) {
        try {
          await this.driver.manage().addCookie({
            name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path || "/",
            secure: cookie.secure, httpOnly: cookie.httpOnly, expiry: cookie.expirationDate ? Math.floor(cookie.expirationDate) : undefined
          } as SeleniumCookie);
        } catch (e) { /* ignore */ }
      }
    }
  }

  public async ensureLoggedIn(): Promise<boolean> {
    const cookies = this.loadCookies();
    if (!cookies) return false;

    await this.initDriver(cookies);
    try {
      this.logger.info("Kiểm tra session...");
      await this.driver!.get(`${X_BASE_URL}/home`);
      await this.driver!.wait(until.elementLocated(By.css(PRIMARY_COLUMN_SELECTOR_CSS)), 15000);
      this.logger.info("Login OK.");
      return true;
    } catch (e) {
      this.logger.error("Cookie hết hạn hoặc lỗi login.", e);
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

  /* ======================= LOGIC CÀO (REFACTORED) ======================= */

  private async parseTweetElement(el: WebElement): Promise<Tweet | null> {
    try {
      const timeElem = await el.findElement(By.css(TIME_SELECTOR_CSS));
      const tweetTimeStr = await timeElem.getAttribute("datetime");
      if (!tweetTimeStr) return null;

      let text = "";
      const nodes = await el.findElements(By.css(TWEET_TEXT_SELECTOR_CSS));
      for (const node of nodes) text += await node.getText();

      let tweetUrl = "unknown";
      let username: string | undefined;
      try {
        const linkElem = await el.findElement(By.css(TWEET_LINK_SELECTOR));
        const href = await linkElem.getAttribute("href");
        if (href) {
          tweetUrl = href.startsWith("http") ? href : `https://x.com${href}`;
          const match = tweetUrl.match(/x\.com\/([^\/]+)\/status/);
          if (match) username = match[1];
        }
      } catch {}

      let replyCount: number | undefined = undefined, retweetCount: number | undefined = undefined, likeCount: number | undefined = undefined;
      try { replyCount = parseKMetric(await el.findElement(By.css(REPLY_COUNT_SELECTOR_CSS)).getText()) ?? undefined; } catch {}
      try { retweetCount = parseKMetric(await el.findElement(By.css(RETWEET_COUNT_SELECTOR_CSS)).getText()) ?? undefined; } catch {}
      try { likeCount = parseKMetric(await el.findElement(By.css(LIKE_COUNT_SELECTOR_CSS)).getText()) ?? undefined; } catch {}

      return {
        time: tweetTimeStr, data: text.trim(), url: tweetUrl, username,
        replyCount, retweetCount, likeCount, impressionsCount: undefined,
      };
    } catch (e) { return null; }
  }

  public async extractTweets(driver: WebDriver, cutoffDate: Date | null): Promise<Tweet[]> {
    const tweetsMap = new Map<string, Tweet>();
    let consecutiveOldTweets = 0;
    
    this.logger.info(`Bắt đầu cào. Cutoff Date: ${cutoffDate?.toISOString() ?? "NONE"}`);

    try {
      await driver.wait(until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)), 15000);
      let previousHeight = 0;
      let attempts = 0;

      while (tweetsMap.size < this.SAFETY_LIMIT) {
        const articles = await driver.findElements(By.css(TWEET_ARTICLE_SELECTOR_CSS));

        for (const el of articles) {
          const tweet = await this.parseTweetElement(el);
          if (!tweet) continue;
          
          const tweetDate = new Date(tweet.time);

          if (cutoffDate) {
            if (tweetDate <= cutoffDate) {
              consecutiveOldTweets++;
              if (consecutiveOldTweets >= 2) {
                 this.logger.info("Gặp tweet cũ -> Dừng cào.");
                 return Array.from(tweetsMap.values());
              }
            } else {
              consecutiveOldTweets = 0;
            }
          }

          const isNew = cutoffDate ? tweetDate > cutoffDate : true;
          if (tweet.url !== "unknown" && !tweetsMap.has(tweet.url) && isNew) {
             tweetsMap.set(tweet.url, tweet);
          }
        }

        await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
        await driver.sleep(2000);

        const currentHeight = await driver.executeScript("return document.body.scrollHeight") as number;
        if (currentHeight === previousHeight) {
          attempts++;
          if (attempts >= 3) break; 
        } else {
          previousHeight = currentHeight;
          attempts = 0;
        }
      }
    } catch (e) {
      this.logger.warn(`Lỗi scroll/extract: ${e}`);
    }

    return Array.from(tweetsMap.values());
  }

  // (Tìm và thay thế toàn bộ hàm checkSingleAccount trong scraper.ts)

  public async checkSingleAccount(xId: string, cutoffDate?: Date | string | null, closeDriverAfter = true): Promise<Date | null> {
    if (!this.driver) {
      const ok = await this.ensureLoggedIn();
      if (!ok) return null;
    }

    // FIX LỖI 1: Đảm bảo cutoffDate là một đối tượng Date chuẩn (Tránh lỗi toISOString)
    const safeCutoffDate = cutoffDate ? new Date(cutoffDate) : null;

    try {
      this.logger.info(`Truy cập profile: ${xId}`);
      await this.driver!.get(`${X_BASE_URL}/${xId}`);
      await this.driver!.sleep(5000); // Đợi 5s cho trang load hẳn

      // --- FIX LỖI 3: Lấy Follower bằng JS an toàn hơn ---
      let followerCount: number | null = null;
      try {
        const followerText = await this.driver!.executeScript(`
          const el = document.querySelector("a[href$='/followers']");
          return el ? el.innerText : null;
        `) as string | null;

        if (followerText) {
          // Twitter text thường có dạng "1.5M\nFollowers", ta lấy phần số đầu tiên
          const rawNum = followerText.split('\\n')[0].trim();
          followerCount = parseKMetric(rawNum);
          this.logger.info(`Tài khoản ${xId} có ${followerCount} followers.`);
        }
      } catch (e) {
        this.logger.warn(`⚠️ Không lấy được số lượng follower cho ${xId}. DOM X có thể đã thay đổi.`);
      }
      // ----------------------------------

      // Truyền safeCutoffDate vào thay vì cutoffDate gốc
      const extracted = await this.extractTweets(this.driver!, safeCutoffDate);
      
      const hasEngagement = extracted.some(t => t.likeCount !== null || t.retweetCount !== null);
      if (extracted.length > 0 && !hasEngagement) {
         this.logger.warn(`🚨 CẢNH BÁO QUANT: ${extracted.length} tweets nhưng TOÀN BỘ tương tác = null. CSS Selectors có thể đã gãy!`);
      }

      this.logger.info(`Đã tìm thấy ${extracted.length} tweets MỚI từ ${xId}`);

      if (extracted.length > 0) {
        return await saveTweets(xId, extracted, followerCount); 
      }
      return null;
    } catch (error) {
      this.logger.error(`Lỗi khi xử lý account ${xId}`, error);
      return null;
    } finally {
      if (closeDriverAfter) {
         await this.closeDriver();
      }
    }
  }

  public async checkXAccounts(): Promise<{ processed: number; success: number }> {
    const accounts = await getAllXAccounts();
    this.logger.info(`Tìm thấy ${accounts.length} account trong DB cần scan.`);
    
    let processed = 0, success = 0;
    if (!this.driver) {
        const ok = await this.ensureLoggedIn();
        if (!ok) return { processed: 0, success: 0 };
    }

    for (const acc of accounts) {
      // FIX LỖI 2: Truyền FALSE vào tham số thứ 3 (closeDriverAfter) 
      // để giữ trình duyệt mở chạy liên tục cho tất cả account
      const result = await this.checkSingleAccount(acc.id, acc.lastTweetUpdatedAt, false);
      
      processed++;
      if (result) success++;
      
      // Delay ngẫu nhiên giữa các account (3-5s) để tránh bị Twitter Block/Rate Limit
      await this.driver!.sleep(3000 + Math.random() * 2000); 
    }

    // Sau khi quét XONG TOÀN BỘ 15 account thì mới Đóng trình duyệt
    await this.closeDriver();

    return { processed, success };
  }
}