// FORCE UTC TOÀN HỆ THỐNG TRÁNH LỆCH MÚI GIỜ
process.env.TZ = "UTC";

import * as db from "./db.js"; 
import { NewsScraper } from "./scraper.js";

type ProcessResult = { success: boolean; message: string; data?: unknown; };

declare const process: { env: Record<string, string | undefined> };

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildAggregateRegex(tokens: Array<{ symbol?: string | null }>): RegExp | null {
  // Lọc ra các symbol hợp lệ và ép VIẾT HOA toàn bộ
  const validSymbols = [...new Set(tokens
    .map(t => (t.symbol ?? "").trim().toUpperCase())
    .filter(s => s.length >= 2))];

  if (validSymbols.length === 0) return null;

  // Xây dựng 3 trường hợp cho mỗi symbol: $LINK, $link, và LINK
  const matchers = validSymbols.map(sym => {
    const symUpper = escapeRegex(sym);
    const symLower = escapeRegex(sym.toLowerCase());
    return `\\$${symUpper}|\\$${symLower}|${symUpper}`;
  });

  const pattern = matchers.join("|");
  
  // 🚀 QUAN TRỌNG: Chỉ dùng cờ "g" (Global), XÓA BỎ cờ "i" (Case-Insensitive)
  return new RegExp(`(?<![a-zA-Z0-9])(?:${pattern})(?![a-zA-Z0-9])`, "g");
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

export async function processNewsScraping(options?: { specificSiteId?: string }): Promise<ProcessResult> {
  const start = Date.now();
  const apiKey = process.env.FIRECRAWL_API_KEY ?? "";

  if (!apiKey) return { success: false, message: "FIRECRAWL_API_KEY is not set" };

  try {
    const scraper = new NewsScraper(apiKey);
    const sites = await db.loadNewsSites();
    const tokens = await db.loadTokens();
    
    const aggregateRegex = buildAggregateRegex(tokens as any[]);
    const maxArticlesPerSite = getEnvInt("NEWS_MAX_ARTICLES_PER_SITE", 10);
    const concurrency = getEnvInt("NEWS_SCRAPE_CONCURRENCY", 3);

    const filteredSites = options?.specificSiteId
      ? sites.filter((s: any) => String(s._id) === options.specificSiteId)
      : sites;

    if (filteredSites.length === 0) return { success: true, message: "No news sites found", data: { count: 0 } };

    const results: any[] = [];

    for (const site of filteredSites) {
      try {
        let articleUrls: string[] = [];

        if ((site as any).rss) {
          articleUrls = await scraper.discoverFromRSS((site as any).rss);
        }
        
        if (articleUrls.length === 0) {
          console.log(`[Discovery Fallback 1] RSS trống. Cào link động bằng HTML cho ${site.url}...`);
          articleUrls = await scraper.discoverLinksWithCheerio(site.url);
        }

        if (articleUrls.length === 0) {
          console.log(`[Discovery Fallback 2] Cào HTML thất bại. Gọi Firecrawl Map cho ${site.url}...`);
          articleUrls = await scraper.discoverArticles(site.url);
        }

        if (articleUrls.length === 0) {
          results.push({ siteUrl: site.url, status: "skipped", message: "No article URLs" });
          continue;
        }

        const existingUrls = await db.findExistingArticleUrls(articleUrls);
        
        let pendingUrls = articleUrls.filter((u) => !existingUrls.has(u))
        // BẮT BUỘC PHẢI CÓ ĐOẠN NÀY ĐỂ ƯU TIÊN LINK MỚI NHẤT TỪ FIRECRAWL MAP
        pendingUrls.sort((a, b) => {
          const matchA = a.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
          const matchB = b.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
          
          if (matchA && matchB) return b.localeCompare(a); 
          else if (matchA) return -1;
          else if (matchB) return 1;
          
          return a.length - b.length; 
        });

        pendingUrls = pendingUrls.slice(0, maxArticlesPerSite);

        if (pendingUrls.length === 0) {
          results.push({ siteUrl: site.url, status: "skipped", message: "All discovered articles already scraped" });
          continue;
        }

        let savedCount = 0;

        await mapLimit(pendingUrls, concurrency, async (articleUrl) => {
          try {
            const scraped = await scraper.scrapeArticle(articleUrl);

            const fullText = [scraped.title, scraped.summary, scraped.content].filter(Boolean).join("\n");

            let detectedTokens: string[] = [];
            if (aggregateRegex) {
              const matches = fullText.match(aggregateRegex) || [];
              detectedTokens = [...new Set(matches.map(m => m.replace(/\$/g, '').toUpperCase()))];
            }

            if (detectedTokens.length === 0) return "skipped";

            await db.upsertNewsArticle({
              siteUrl: site.url,
              articleUrl,
              title: scraped.title,
              summary: scraped.summary,
              content: scraped.content,
              publishedAt: scraped.publishedAt ?? null,
              detectedTokens, 
              raw: scraped.raw,
              scrapedAt: new Date(),
            });

            savedCount++;
            return "saved";
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.log(`[Bộ lọc] Đã bỏ qua bài viết ${articleUrl}: ${errMsg}`);
            if (errMsg.includes("FATAL_FIRECRAWL_OUT_OF_CREDITS")) throw err;
            return "error";
          }
        });

        await db.updateNewsSiteContent(String(site._id), `saved ${savedCount} articles`);
        results.push({ siteUrl: site.url, status: "saved", count: savedCount });

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
      message: `Processed ${filteredSites.length} site(s) in ${Date.now() - start}ms`,
      data: results,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}