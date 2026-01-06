import fs from "fs";
import path from "path";

import { Logger, LogLevel } from "../../shared/src";
import {
  Builder,//tạo browser
  By,//tìm css
  Key,
  until,///chờ element xuất hiện
  WebDriver,
  WebElement,
  IWebDriverOptionsCookie as SeleniumCookie,
} from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";

import { getAllXAccounts, saveTweets } from "./db";
import { randomDelay } from "./utils";
import {
  X_BASE_URL,
  TWEET_ARTICLE_SELECTOR_CSS,
  TIME_SELECTOR_CSS,
  DEFAULT_SELENIUM_SCRIPT_TIMEOUT,
  ELEMENT_LOCATE_TIMEOUT_MS,
  PAGE_LOAD_WAIT_MS,
  REPLY_COUNT_SELECTOR_CSS,
  RETWEET_COUNT_SELECTOR_CSS,
  LIKE_COUNT_SELECTOR_CSS,
  TWEET_TEXT_SELECTOR_CSS,
  PRIMARY_COLUMN_SELECTOR_CSS,
  COOKIES_DIR_RELATIVE,
  COOKIES_FILENAME,
  MAX_TWEETS_TO_PROCESS_PER_ACCOUNT,
} from "./constant";

/* ======================= TYPES ======================= */

interface Credentials { //login info
  email: string;
  password: string;
  username: string;
}

interface Tweet {
  time: string;
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
  private driver: WebDriver | null = null;//chrome driver
  private credentials: Credentials;
  private logger = new Logger({ level: LogLevel.INFO });

  constructor(credentials: Credentials) {
    this.credentials = credentials;
  }

  /* ======================= COOKIES ======================= */

  private getCookiesFilePath(): string {
    // Sửa logic lấy path tuyệt đối để đảm bảo tìm đúng file
    const rootDir = path.resolve(__dirname, "../../x-scaper");
    const dir = path.join(rootDir, "cookies");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "x-scraper_cookies.json");
  }

  private loadCookies(): any[] | null {
    const filePath = this.getCookiesFilePath();
    this.logger.info("loadCookies", `Đang kiểm tra file cookie tại: ${filePath}`);
    if (!fs.existsSync(filePath)) {
        this.logger.error("loadCookies", "KHÔNG TÌM THẤY FILE COOKIE. Vui lòng tạo file core/x-scaper/cookies/x-scraper_cookies.json");
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
      "--headless=new", // Chạy ẩn
      "--no-sandbox",
      "--disable-dev-shm-usage",//tránh crash
      "--disable-blink-features=AutomationControlled",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      //fake chrome thật
    );

    options.excludeSwitches("enable-automation");//Ẩn flag automation
    options.setUserPreferences({ "useAutomationExtension": false });//Tắt extension automation

    this.driver = await new Builder()//tạo instance  chrome
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

    await this.driver.executeScript(
      "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    );

    if (cookies?.length) {
      this.logger.info("initDriver", "Đang nạp Cookie vào trình duyệt...");
      await this.driver.get(X_BASE_URL);
      for (const cookie of cookies) {
        try {
          // EditThisCookie dùng 'expirationDate', Selenium cần 'expiry'
          const seleniumCookie = {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || "/",
            secure: cookie.secure,//chỉ gửi cookie qua https
            httpOnly: cookie.httpOnly,
            expiry: cookie.expirationDate ? Math.floor(cookie.expirationDate) : undefined//thời gian hết hạn cookies
          };
          await this.driver.manage().addCookie(seleniumCookie as SeleniumCookie);
        } catch (e) { /* ignore */ }
      }
    }
  }

  public async ensureLoggedIn(): Promise<boolean> {
    const cookies = this.loadCookies();
    
    if (!cookies) {
        this.logger.error("ensureLoggedIn", "Dừng lại: Không có cookie để đăng nhập.");
        return false;
    }

    await this.initDriver(cookies);
    
    try {
      this.logger.info("ensureLoggedIn", "Đang kiểm tra session bằng Cookie...");
      await this.driver!.get(`${X_BASE_URL}/home`);
      await this.driver!.wait(until.elementLocated(By.css(PRIMARY_COLUMN_SELECTOR_CSS)), 15000);
      this.logger.info("ensureLoggedIn", "Bypass Login thành công bằng Cookie.");
      return true;
    } catch (e) {
      this.logger.error("ensureLoggedIn", "Cookie hết hạn hoặc X bắt đăng nhập lại. Vui lòng cập nhật lại x-scraper_cookies.json");
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

  /* ======================= SCRAPE LOGIC ======================= */

  public async extractTweets(driver: WebDriver): Promise<Tweet[]> {
  const tweets: Tweet[] = [];

  try {
    await driver.wait(
      until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)),
      15000
    );

    const articles = await driver.findElements(
      By.css(TWEET_ARTICLE_SELECTOR_CSS)
    );

    for (
      let i = 0;
      i < Math.min(articles.length, MAX_TWEETS_TO_PROCESS_PER_ACCOUNT);
      i++
    ) {
      const el = articles[i];

      let text = "";
      let replyCount: number | null = null;
      let retweetCount: number | null = null;
      let likeCount: number | null = null;

      try {
        // ---- content ----
        const nodes = await el.findElements(By.css(TWEET_TEXT_SELECTOR_CSS));
        for (const node of nodes) {
          text += await node.getText();
        }

        // ---- time ----
        const timeElem = await el.findElement(By.css(TIME_SELECTOR_CSS));
        const tweetTime = await timeElem.getAttribute("datetime");

        if (!tweetTime) continue; //bỏ tweet không có thời gian

        // ---- engagement ----
        try {
          const replyText = await el
            .findElement(By.css(REPLY_COUNT_SELECTOR_CSS))
            .getText();
          const v = parseEngagementCount(replyText);
          replyCount = Number.isFinite(v) ? v : null;
        } catch {}

        try {
          const retweetText = await el
            .findElement(By.css(RETWEET_COUNT_SELECTOR_CSS))
            .getText();
          const v = parseEngagementCount(retweetText);
          retweetCount = Number.isFinite(v) ? v : null;
        } catch {}

        try {
          const likeText = await el
            .findElement(By.css(LIKE_COUNT_SELECTOR_CSS))
            .getText();
          const v = parseEngagementCount(likeText);
          likeCount = Number.isFinite(v) ? v : null;
        } catch {}

        tweets.push({
          time: tweetTime,
          data: text.trim(),
          url: "extracted_from_feed",
          replyCount,
          retweetCount,
          likeCount,
          impressionsCount: null,
        });
      } catch {
        continue;
      }
    }
  } catch {
    this.logger.warn("extractTweets", "Không tìm thấy tweet nào.");
  }

  return tweets;
}


  public async checkSingleAccount(
  xId: string,
  closeDriverAfter: boolean = true
): Promise<Date | null> {

  if (!this.driver) {
    const ok = await this.ensureLoggedIn();
    if (!ok) return null;
  }

  try {
    await this.driver!.get(`${X_BASE_URL}/${xId}`);
    await this.driver!.sleep(5000); // chờ DOM load

    const extracted = await this.extractTweets(this.driver!);
    this.logger.info(
      "checkSingleAccount",
      `Đã lấy được ${extracted.length} tweets từ ${xId}`
    );

    //  THÊM PHẦN LƯU DB
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
    let processed = 0, success = 0;
    for (const acc of accounts) {
      const ts = await this.checkSingleAccount(acc.id, false);
      if (ts) success++;
      processed++;
    }
    await this.closeDriver();
    return { processed, success };
  }
}