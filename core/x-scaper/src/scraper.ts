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
  LOGIN_URL,
  INITIAL_INPUT_SELECTOR_CSS,
  NEXT_BUTTON_XPATH,
  PASSWORD_SELECTOR_CSS,
  COOKIES_DIR_RELATIVE,
  COOKIES_FILENAME
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
  isRetweet?: boolean;
  originalUsername?: string;
}

/* ======================= UTILS ======================= */
function parseKMetric(text: string | null): number | null {
  if (!text) return null;
  let clean = text.trim().toUpperCase();

  if (clean.includes("K") || clean.includes("M")) {
    const multiplier = clean.includes("K") ? 1000 : 1_000_000;
    clean = clean.replace(/[KM]/g, "").replace(/,/g, ".");
    const num = parseFloat(clean);
    return Number.isNaN(num) ? null : Math.round(num * multiplier);
  }

  const digitsOnly = clean.replace(/\D/g, "");
  const num = parseInt(digitsOnly, 10);
  return Number.isNaN(num) ? null : num;
}

/* ======================= SCRAPER ======================= */
export class XScraper {
  private driver: WebDriver | null = null;
  private credentials: Credentials;
  private logger = new Logger('XScraper');
  private readonly SAFETY_LIMIT = 50; 

  constructor(credentials: Credentials) {
    this.credentials = credentials;
  }

  /* -------Cookies và Init Driver-------------- */
  
  private getCookiesFilePath(): string {
    const dir = path.join(process.cwd(), COOKIES_DIR_RELATIVE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, COOKIES_FILENAME);
  }

  private loadCookies(): any[] | null {
    const filePath = this.getCookiesFilePath();
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {
      this.logger.error("Lỗi đọc file JSON cookie.", e);
      return null;
    }
  }

  private async saveCookies(): Promise<void> {
    if (!this.driver) return;
    try {
      const cookies = await this.driver.manage().getCookies();
      fs.writeFileSync(this.getCookiesFilePath(), JSON.stringify(cookies, null, 2));
      this.logger.info("Đã lưu cookie mới thành công.");
    } catch (error) {
      this.logger.error("Lỗi khi lưu cookie:", error);
    }
  }

  private async loginAndSaveCookies(): Promise<boolean> {
    try {
      this.logger.info("Tiến hành đăng nhập bằng Credentials...");
      await this.driver!.get(LOGIN_URL);

      const usernameInput = await this.driver!.wait(until.elementLocated(By.css(INITIAL_INPUT_SELECTOR_CSS)), 20000);
      await this.driver!.wait(until.elementIsVisible(usernameInput), 10000);
      await usernameInput.sendKeys(this.credentials.username);
      
      const nextBtn = await this.driver!.findElement(By.xpath(NEXT_BUTTON_XPATH));
      await nextBtn.click();
      await this.driver!.sleep(2000 + Math.random() * 1000);

      const pwdInput = await this.driver!.wait(until.elementLocated(By.css(PASSWORD_SELECTOR_CSS)), 15000);
      await this.driver!.wait(until.elementIsVisible(pwdInput), 10000);
      await pwdInput.sendKeys(this.credentials.password);

      const loginBtn = await this.driver!.findElement(By.xpath("//button[.//span[text()='Log in']]"));
      await loginBtn.click();

      try {
        await this.driver!.wait(until.elementLocated(By.css(PRIMARY_COLUMN_SELECTOR_CSS)), 20000);
        this.logger.info("Đăng nhập thành công! Đang lưu lại Cookie...");
        await this.saveCookies();
        return true;
      } catch (waitErr) {
        try {
          const pageText = await this.driver!.findElement(By.css("body")).getText();
          const textLower = pageText.toLowerCase();
          if (textLower.includes("verify") || textLower.includes("unusual") || textLower.includes("confirmation")) {
             this.logger.error("🚨 Dính Checkpoint bảo mật của X (Yêu cầu xác minh). Graceful Shutdown!");
             return false;
          }
        } catch (e) {}
        this.logger.error("🚨 Lỗi timeout khi chờ load trang chủ X.");
        return false;
      }

    } catch (error) {
      this.logger.error("Lỗi trong quá trình Auto Login:", error);
      return false;
    }
  }

  private async initDriver(cookies?: any[]): Promise<void> {
    const options = new chrome.Options();
    options.addArguments(
      "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--lang=en-US", 
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    options.excludeSwitches("enable-automation");
    options.setUserPreferences({ "useAutomationExtension": false });

    this.driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
    await this.driver.executeScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");

    if (cookies?.length) {
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
    const cookieLoaded = await this.loadCookies();

    if (!this.driver) {
      await this.initDriver(cookieLoaded || undefined);
    }

    if (cookieLoaded) {
      await this.driver!.get(X_BASE_URL);
      await this.driver!.sleep(3000);
      const currentUrl = await this.driver!.getCurrentUrl();
      if (!currentUrl.includes("i/flow/login")) return true;
      this.logger.warn("Cookie đã hết hạn hoặc bị X từ chối.");
    }
    return await this.loginAndSaveCookies();
  }

  private async closeDriver(): Promise<void> {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
    }
  }

  /* ======================= LOGIC CÀO ======================= */
  
  private async parseTweetElement(el: WebElement, preFetchedUrl: string, preFetchedUsername?: string): Promise<Tweet | null> {
    try {
      const timeElem = await el.findElement(By.css(TIME_SELECTOR_CSS));
      const tweetTimeStr = await timeElem.getAttribute("datetime");
      if (!tweetTimeStr) return null;

      let text = "";
      const nodes = await el.findElements(By.css(TWEET_TEXT_SELECTOR_CSS));
      for (const node of nodes) text += await node.getText();

      let replyCount: number | undefined = undefined, retweetCount: number | undefined = undefined, likeCount: number | undefined = undefined;
      try { replyCount = parseKMetric(await el.findElement(By.css(REPLY_COUNT_SELECTOR_CSS)).getText()) ?? undefined; } catch {}
      try { retweetCount = parseKMetric(await el.findElement(By.css(RETWEET_COUNT_SELECTOR_CSS)).getText()) ?? undefined; } catch {}
      try { likeCount = parseKMetric(await el.findElement(By.css(LIKE_COUNT_SELECTOR_CSS)).getText()) ?? undefined; } catch {}

      return {
        time: tweetTimeStr, data: text.trim(), url: preFetchedUrl, username: preFetchedUsername,
        replyCount, retweetCount, likeCount
      };
    } catch (e) { 
      this.logger.debug("⚠️ Không tìm thấy thẻ Time/Text hoặc lỗi parse, DOM X có thể đã thay đổi:", e);
      return null; 
    }
  }

  public async extractTweets(driver: WebDriver, cutoffDate: Date | null, targetUsername: string): Promise<Tweet[]> {
    const tweetsMap = new Map<string, Tweet>();
    const processedUrls = new Set<string>(); 
    
    let consecutiveOldTweets = 0;
    let consecutiveOldRetweets = 0; 
    
    const cleanTarget = targetUsername.replace(/^@/, "").toLowerCase();
    
    try {
      await driver.wait(until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)), 15000);
    } catch (timeoutErr) {
      await driver.navigate().refresh();
      await driver.sleep(5000 + Math.random() * 2000); 
      try {
        await driver.wait(until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)), 15000);
      } catch (finalErr) { return Array.from(tweetsMap.values()); }
    }

    try {
      let previousHeight = 0;
      let attempts = 0;
      let scrollCount = 0; 
      const MAX_SCROLLS = 30; 

      while (tweetsMap.size < this.SAFETY_LIMIT && scrollCount < MAX_SCROLLS) {
        const articles = await driver.findElements(By.css(TWEET_ARTICLE_SELECTOR_CSS));

        for (const el of articles) {
          try {
             const isScraped = await el.getAttribute("data-scraped");
             if (isScraped) continue; 
          } catch (err: any) {
             if (err.name === 'StaleElementReferenceError') continue;
          }

          let tweetUrl = "unknown";
          let username: string | undefined;
          let isSelfReply = false; // Cờ kiểm tra Thread / Self-reply
          
          try {
            // Tích hợp việc đọc "Replying to" vào trong cùng 1 lệnh JS để tối ưu hoàn toàn hiệu năng
            const extractedData = await driver.executeScript(`
                const el = arguments[0];
                let url = null;
                let replyingTo = null;
                
                try {
                    const timeElem = el.querySelector("time");
                    if (timeElem) {
                        const linkElem = timeElem.closest("a");
                        if (linkElem) url = linkElem.href;
                    }
                } catch(e) {}
                
                try {
                    // Trình duyệt sẽ render nội dung này ở dạng văn bản nếu có
                    const match = el.innerText.match(/Replying to\\s+(@[\\w_]+)/i);
                    if (match) replyingTo = match[1];
                } catch(e) {}
                
                return { url, replyingTo };
            `, el) as { url: string | null, replyingTo: string | null };

            if (extractedData.url) {
                tweetUrl = extractedData.url.startsWith("http") ? extractedData.url : `https://x.com${extractedData.url}`;
                tweetUrl = tweetUrl.split("?")[0]; 
                
                const match = tweetUrl.match(/(?:x\.com|twitter\.com)\/([^\/]+)\/status/);
                if (match) username = match[1];
            }

            // Gọt sạch "@" để so sánh xem tài khoản bị reply có phải là chính nó không
            if (extractedData.replyingTo) {
                const replyingToUser = extractedData.replyingTo.replace('@', '').toLowerCase();
                if (replyingToUser === cleanTarget) {
                    isSelfReply = true;
                }
            }

          } catch (err: any) {
             if (err.name === 'StaleElementReferenceError') {
                 this.logger.debug("DOM thay đổi quá nhanh, bỏ qua 1 thẻ bị Stale.");
                 continue; 
             }
          }

          try {
             await driver.executeScript("arguments[0].setAttribute('data-scraped', 'true');", el);
          } catch(e) {} 

          // ==========================================
          // 🚨 BỘ LỌC THREAD (TỰ REPLY) CHÍNH XÁC:
          // Bỏ qua hoàn toàn bài viết này trước khi gọi Selenium tốn CPU
          // ==========================================
          if (isSelfReply) {
             this.logger.debug(`⏩ Bỏ qua bài Thread (tự Reply) của ${cleanTarget} tại ${tweetUrl}`);
             continue;
          }

          if (tweetUrl === "unknown" || processedUrls.has(tweetUrl)) continue;
          processedUrls.add(tweetUrl);

          const tweet = await this.parseTweetElement(el, tweetUrl, username);
          if (!tweet) continue;

          if (tweetsMap.has(tweet.url)) continue;

          const isRetweet =
          !!tweet.username &&
          !!cleanTarget &&
          tweet.username.toLowerCase() !== cleanTarget;
          const tweetDate = new Date(tweet.time);

          if (isNaN(tweetDate.getTime())) {
              this.logger.debug(`Không thể parse thời gian bài viết: ${tweet.time}, loại bỏ (drop) dữ liệu này.`);
              continue; 
          }

          if (cutoffDate) {
            if (tweetDate <= cutoffDate) {
              if (!isRetweet) {
                consecutiveOldTweets++;
                if (consecutiveOldTweets >= 2) {
                   this.logger.info("Gặp dữ liệu chính chủ cũ trên timeline -> Dừng cào.");
                   return Array.from(tweetsMap.values());
                }
              } else {
                consecutiveOldRetweets++;
                if (consecutiveOldRetweets >= 10) {
                   this.logger.info("Gặp quá nhiều Retweet cũ (10 bài liên tiếp) -> Dừng cào để giải phóng tài nguyên.");
                   return Array.from(tweetsMap.values());
                }
              }
              continue; 
            } else {
              if (!isRetweet) consecutiveOldTweets = 0; 
              consecutiveOldRetweets = 0;
            }
          }

          tweet.isRetweet = isRetweet;
          tweet.originalUsername = username;
          
          if (tweet.url !== "unknown") {
             tweetsMap.set(tweet.url, tweet);
          }
        }

        await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
        await driver.sleep(2000);
        scrollCount++; 

        const currentHeight = await driver.executeScript("return document.body.scrollHeight") as number;
        if (currentHeight === previousHeight) {
          attempts++;
          if (attempts >= 3) break; 
        } else {
          previousHeight = currentHeight;
          attempts = 0;
        }
      }

      if (scrollCount >= MAX_SCROLLS) {
        this.logger.warn(`🚨 Chạm giới hạn an toàn scroll (${MAX_SCROLLS}) cho ${targetUsername}. Ép dừng cào để chống kẹt tiến trình.`);
      }

    } catch (e) {
      this.logger.warn("Lỗi scroll/extract:", e);
    }

    return Array.from(tweetsMap.values());
  }

  public async checkSingleAccount(xId: string, cutoffDate?: Date | string | null, closeDriverAfter = true): Promise<Date | null> {
    let safeCutoffDate = cutoffDate ? new Date(cutoffDate) : null;
    if (safeCutoffDate && isNaN(safeCutoffDate.getTime())) {
       safeCutoffDate = null; 
    }
    
    try {
      if (!this.driver) {
        const ok = await this.ensureLoggedIn();
        if (!ok) return null; 
      }

      this.logger.info(`Truy cập profile: ${xId}`);
      await this.driver!.get(`${X_BASE_URL}/${xId}`);
      await this.driver!.sleep(5000); 

      let followerCount: number | null = null;
      try {
        const followerText = await this.driver!.executeScript(`
          const el = document.querySelector("a[href$='/followers'], a[href$='/verified_followers']");
          return el ? el.innerText : null;
        `) as string | null;

        if (followerText) {
          const rawNum = followerText.split('\n')[0].trim();
          followerCount = parseKMetric(rawNum);
        }
      } catch (e) {}

      const extracted = await this.extractTweets(this.driver!, safeCutoffDate, xId);
      
      const hasEngagement = extracted.some(t => t.likeCount !== null || t.retweetCount !== null);
      if (extracted.length > 0 && !hasEngagement) {
         this.logger.warn(`🚨 CẢNH BÁO QUANT: ${extracted.length} tweets nhưng tương tác = null. CSS Selectors gãy!`);
      }

      this.logger.info(`Đã tìm thấy ${extracted.length} tweets (bao gồm cả Retweets) từ ${xId}`);

      if (extracted.length > 0) {
        return await saveTweets(xId, extracted, followerCount); 
      }
      return null;
    } catch (error) {
      this.logger.error(`Lỗi khi xử lý account ${xId}`, error);
      return null;
    } finally {
      if (closeDriverAfter) await this.closeDriver();
    }
  }

  public async checkXAccounts(): Promise<{ processed: number; success: number }> {
    const accounts = await getAllXAccounts();
    this.logger.info(`Tìm thấy ${accounts.length} account trong DB cần scan.`);
    
    let processed = 0, success = 0;
    const BATCH_SIZE = 20; 
    
    try {
      if (!this.driver) {
          const ok = await this.ensureLoggedIn();
          if (!ok) return { processed: 0, success: 0 };
      }

      for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        this.logger.info(`Đang chuẩn bị cào profile: ${acc.id}...`);
        const result = await this.checkSingleAccount(acc.id, acc.lastTweetUpdatedAt, false);
        
        processed++;
        if (result) success++;
        
        if (processed % BATCH_SIZE === 0 && i < accounts.length - 1) {
            this.logger.info(`[MEMORY CLEANUP] Đã cào ${BATCH_SIZE} accounts, tiến hành khởi động lại Chrome...`);
            await this.closeDriver();
            const ok = await this.ensureLoggedIn();
            if (!ok) {
                this.logger.error(`Khởi động lại Chrome thất bại. Dừng Batch Processing.`);
                return { processed, success };
            }
        } else {
            const delayMs = 15000 + Math.random() * 10000; 
            await this.driver!.sleep(delayMs);
        }
      }
    } finally {
      await this.closeDriver();
    }

    return { processed, success };
  }
}