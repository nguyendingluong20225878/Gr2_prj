import * as db from "./db.js";
import { NewsScraper } from "./scraper.js";

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

/**
 * Xây dựng Regex tổng hợp O(1)
 * Quét toàn bộ Token trong 1 lần duy nhất thay vì loop n lần.
 * VD trả về: /(?<!\w)\$?(BTC|ETH|SOL)(?!\w)/gi
 */
function buildAggregateRegex(tokens: Array<{ symbol?: string | null }>): RegExp | null {
  const validSymbols = tokens
    .map(t => (t.symbol ?? "").trim())
    .filter(s => s.length >= 2);

  if (validSymbols.length === 0) return null;

  const pattern = validSymbols
    .map(sym => escapeRegex(sym))
    .join("|");
  
  // Sử dụng \w boundary để chuẩn xác hơn (Bắt được cả token có số như 1INCH)
  return new RegExp(`(?<!\\w)\\$?(${pattern})(?!\\w)`, "gi");
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
    
    // Build 1 lần dùng cho cả tiến trình
    const aggregateRegex = buildAggregateRegex(tokens as any[]);

    const maxArticlesPerSite = getEnvInt("NEWS_MAX_ARTICLES_PER_SITE", 10);
    const concurrency = getEnvInt("NEWS_SCRAPE_CONCURRENCY", 3);

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

        // Ưu tiên RSS để tiết kiệm mapUrl credit
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

        // Lọc những bài đã có trong DB TRƯỚC, sau đó mới cắt Slice (Pagination)
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

            // Quét Token cực nhanh bằng Regex tổng hợp
            let detectedTokens: string[] = [];
            if (aggregateRegex) {
              const matches = fullText.match(aggregateRegex) || [];
              // Làm sạch matches (xóa dấu $ và in hoa) rồi loại trùng lặp
              detectedTokens = [...new Set(matches.map(m => m.replace(/\$/g, '').toUpperCase()))];
            }

            // hard cleanup: skip nếu không có token
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
            //  THÊM ĐOẠN NÀY: Ném thẳng lỗi Fatal ra ngoài để đánh sập mapLimit ngay lập tức
            if (errMsg.includes("FATAL_FIRECRAWL_OUT_OF_CREDITS")) {
            throw err; 
           }
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