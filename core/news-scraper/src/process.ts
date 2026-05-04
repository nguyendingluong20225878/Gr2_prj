import * as db from "./db";
import { NewsScraper } from "./scraper";
// [FIX ISSUE 5] Xóa bỏ hàm findExistingArticleUrls thừa ở đây vì đã gọi db.findExistingArticleUrls

//Định nghĩa kiểu return
type ProcessResult = {
  success: boolean;
  message: string;
  data?: unknown;
};

declare const process: { env: Record<string, string | undefined> };


/* =========================
       REGEX UTILS
========================= */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// STRICT SYMBOL MATCH 
function buildStrictSymbolRegex(symbol: string): RegExp | null {
  const s = symbol?.trim();
  if (!s || s.length < 2) return null;

  const escaped = escapeRegex(s);

  /**
   * Giải thích Regex:
   * (?<![A-Za-z0-9]) : Phía trước không được là chữ cái hoặc số (Negative Lookbehind)
   * \$?              : Cho phép ký hiệu $ ở trước (tùy chọn)
   * ${escaped}       : Symbol của Token
   * (?![A-Za-z0-9])  : Phía sau không được là chữ cái hoặc số (Negative Lookahead)
   */
  const isAllUpperLetters = /^[A-Z]{2,}$/.test(s);
  const flags = isAllUpperLetters ? "" : "i";
  
  return new RegExp(`(?<![A-Za-z0-9])\\$?${escaped}(?![A-Za-z0-9])`, flags);
}

/* =========================
   TOKEN DETECTION
========================= */
type TokenMatcher = {
  symbol: string;
  symbolRe: RegExp | null;
};

function buildTokenMatchers(tokens: Array<{ symbol?: string | null; name?: string | null }>): TokenMatcher[] {
  const matchers: TokenMatcher[] = [];
  for (const t of tokens) {
    const symbol = (t.symbol ?? "").trim();
    const symbolRe = symbol ? buildStrictSymbolRegex(symbol) : null;
    if (!symbolRe) continue;
    // store canonical symbol (UPPER) for detectedTokens
    matchers.push({ symbol, symbolRe });
  }
  return matchers;
}

function detectTokenSymbols(text: string, matchers: TokenMatcher[], opts?: { debug?: boolean }): string[] {
  const matched = new Set<string>();

  function snippetAround(src: string, index: number, radius = 60): string {
    if (!Number.isFinite(index) || index < 0) return "";
    const start = Math.max(0, index - radius);
    const end = Math.min(src.length, index + radius);
    return src.slice(start, end);
  }

  for (const m of matchers) {
    let matchedBy: "symbol" | null = null;
    let matchIndex = -1;

    if (m.symbolRe) {
      // [FIX ISSUE 6]: Xóa dòng m.symbolRe.lastIndex = 0; vì không dùng flag /g hoặc /y
      const exec = m.symbolRe.exec(text);
      if (exec) {
        matchedBy = "symbol";
        matchIndex = exec.index;
      }
    }

    if (matchedBy) {
      const sym = m.symbol;
      if (sym) matched.add(sym.toUpperCase());
      if (opts?.debug) {
        const matchSnippet = snippetAround(text, matchIndex);
        console.log(
          `[token-match] by=${matchedBy} token=${sym.toUpperCase()} matchIndex=${matchIndex} matchSnippet=${JSON.stringify(matchSnippet)}`
        );
      }
    }
  }
  return [...matched];
}

function getEnvInt(name: string, fallback: number): number {
  const v = Number(process.env[name] ?? "");
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

async function mapLimit<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  const workers = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
    while (true) {
      const current = idx++;
      if (current >= items.length) return;
      results[current] = await fn(items[current]);
    }
  });

  await Promise.all(workers);
  return results;
}


/* =========================
    MAIN PROCESS
========================= */

export async function processNewsScraping(
  options?: { specificSiteId?: string }
): Promise<ProcessResult> {
  const start = Date.now();
  const apiKey = process.env.FIRECRAWL_API_KEY ?? "";

  if (!apiKey) {
    return { success: false, message: "FIRECRAWL_API_KEY is not set" };
  }

  try {
    const scraper = new NewsScraper(apiKey);
    const sites = await db.loadNewsSites();
    const tokens = await db.loadTokens();
    const tokenMatchers = buildTokenMatchers(tokens as any[]);

    const maxArticlesPerSite = getEnvInt("NEWS_MAX_ARTICLES_PER_SITE", 10);
    const concurrency = getEnvInt("NEWS_SCRAPE_CONCURRENCY", 3);
    const debugTokenMatch = process.env.DEBUG_TOKEN_MATCH === "1";

    const filteredSites = options?.specificSiteId
      ? sites.filter((s: any) => String(s._id) === options.specificSiteId)
      : sites;

    if (filteredSites.length === 0) {
      return {
        success: true,
        message: "No news sites found",
        data: { count: 0 },
      };
    }

    const results: any[] = [];

    for (const site of filteredSites) {
      try {
        /* =========================
           STEP 1: DISCOVERY
        ========================= */

        let articleUrls: string[] = [];

        if ((site as any).rss) {
          articleUrls = await scraper.discoverFromRSS((site as any).rss);
        } else {
          articleUrls = await scraper.discoverArticles(site.url);
        }

        if (articleUrls.length === 0) {
          results.push({
            siteUrl: site.url,
            status: "skipped",
            message: "No article URLs",
          });
          continue;
        }

        // [FIX ISSUE 2]: Check Data tồn tại TRƯỚC, cắt giới hạn (slice) SAU để tránh Pagination lỗi
        const existingUrls = await db.findExistingArticleUrls(articleUrls);
        const pendingUrls = articleUrls
          .filter((u) => !existingUrls.has(u))
          .slice(0, maxArticlesPerSite); // cap per site to reduce cost/time

        if (pendingUrls.length === 0) {
          results.push({
            siteUrl: site.url,
            status: "skipped",
            message: "All discovered articles already scraped",
          });
          continue;
        }

        let savedCount = 0;

        /* =========================
           STEP 2: SCRAPE LOOP
        ========================= */

        await mapLimit(pendingUrls, concurrency, async (articleUrl) => {
          try {
            const scraped = await scraper.scrapeArticle(articleUrl);

            const fullText = [scraped.title, scraped.summary, scraped.content]
              .filter(Boolean)
              .join("\n");

            const detectedTokens = detectTokenSymbols(fullText, tokenMatchers, {
              debug: debugTokenMatch,
            });

            //  hard cleanup: skip nếu không có token
            if (detectedTokens.length === 0) return "skipped";

            await db.upsertNewsArticle({
              siteUrl: site.url,
              articleUrl,
              title: scraped.title,
              summary: scraped.summary,
              content: scraped.content,
              publishedAt: scraped.publishedAt ?? null,
              detectedTokens, // ✅ store symbols (UPPERCASE)
              raw: scraped.raw,
              scrapedAt: new Date(),
            });

            savedCount++;
            return "saved";
          } catch (err) {
            // Lấy thông báo lỗi ngắn gọn
            const errMsg = err instanceof Error ? err.message : String(err);
            // Log ra gọn gàng
            console.log(`[Bộ lọc] Đã bỏ qua bài viết ${articleUrl}: ${errMsg}`);
            return "error";
          }
        });

        await db.updateNewsSiteContent(
          String(site._id),
          `saved ${savedCount} articles`
        );

        results.push({
          siteUrl: site.url,
          status: "saved",
          count: savedCount,
        });
      } catch (error) {
        results.push({
          siteUrl: site.url,
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return {
      success: true,
      message: `Processed ${filteredSites.length} site(s) in ${
        Date.now() - start
      }ms`,
      data: results,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}