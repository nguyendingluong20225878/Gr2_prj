// FORCE UTC TOÀN HỆ THỐNG TRÁNH LỆCH MÚI GIỜ
process.env.TZ = "UTC";

import * as db from "./db.js"; 
import { NewsScraper } from "./scraper.js";
import fs from "fs";
import path from "path";

type ProcessResult = { success: boolean; message: string; data?: unknown; };

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type TokenMatcher = { symbol: string; regex: RegExp };

function buildTokenMatchers(tokens: Array<{ symbol?: string | null; name?: string | null }>): TokenMatcher[] {
  const matchers: TokenMatcher[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const symbol = (token.symbol ?? "").trim().toUpperCase();
    if (!symbol || symbol.length < 2 || seen.has(symbol)) continue;
    seen.add(symbol);

    const symbolUpper = escapeRegex(symbol);
    const symbolLower = escapeRegex(symbol.toLowerCase());
    const parts = [`\\$${symbolUpper}`, `\\$${symbolLower}`, symbolUpper];

    const name = (token.name ?? "").trim();
    if (
      name &&
      name.length >= 4 &&
      name.toUpperCase() !== symbol &&
      !["THE", "AND", "USD", "USDT"].includes(name.toUpperCase())
    ) {
      const nameCapitalized = escapeRegex(
        name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
      );
      const nameUpper = escapeRegex(name.toUpperCase());
      parts.push(nameCapitalized, nameUpper);
    }

    matchers.push({
      symbol,
      regex: new RegExp(`(?<![a-zA-Z0-9])(?:${parts.join("|")})(?![a-zA-Z0-9])`),
    });
  }

  return matchers;
}

function detectTokenSymbols(text: string, matchers: TokenMatcher[]): string[] {
  const matched = new Set<string>();
  for (const matcher of matchers) {
    matcher.regex.lastIndex = 0;
    if (matcher.regex.test(text)) matched.add(matcher.symbol);
  }
  return [...matched];
}

function getEnvInt(name: string, fallback: number): number {
  const v = Number(process.env[name] ?? "");
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

function getEnvBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function uniquePreserveOrder(values: string[]): string[] {
  return [...new Set(values)];
}

function urlDateTime(url: string): number | null {
  const match = url.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
  if (!match) return null;
  const parsed = new Date(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function sortNewestFirst(urls: string[]): string[] {
  return urls
    .map((url, index) => ({ url, index, dateTime: urlDateTime(url) }))
    .sort((a, b) => {
      if (a.dateTime !== null && b.dateTime !== null) return b.dateTime - a.dateTime;
      if (a.dateTime !== null) return -1;
      if (b.dateTime !== null) return 1;
      return a.index - b.index;
    })
    .map((item) => item.url);
}

function takeUntilFirstExisting(urls: string[], existingUrls: Set<string>): string[] {
  const pending: string[] = [];
  for (const url of urls) {
    if (existingUrls.has(url)) break;
    pending.push(url);
  }
  return pending;
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
    
    const tokenMatchers = buildTokenMatchers(tokens as any[]);
    const maxArticlesPerSite = getEnvInt("NEWS_MAX_ARTICLES_PER_SITE", 50);
    const concurrency = getEnvInt("NEWS_SCRAPE_CONCURRENCY", 3);
    const alwaysMap = getEnvBool("NEWS_ALWAYS_FIRECRAWL_MAP", false);
    const stopAtFirstExisting = getEnvBool("NEWS_STOP_AT_FIRST_EXISTING", true);

    const filteredSites = options?.specificSiteId
      ? sites.filter((s: any) => String(s._id) === options.specificSiteId)
      : sites;

    if (filteredSites.length === 0) return { success: true, message: "No news sites found", data: { count: 0 } };

    const results: any[] = [];

    for (const site of filteredSites) {
      try {
        const discoveredBySource: Record<string, number> = {};
        let articleUrls: string[] = [];

        const MAX_FIRECRAWL_DISCOVER = getEnvInt("NEWS_FIRECRAWL_MAX_DISCOVER", 10);
        const FIRECRAWL_SKIP_RECENT_COUNT = getEnvInt("NEWS_FIRECRAWL_SKIP_IF_RECENT_COUNT", 10);
        const RECENT_DAYS = getEnvInt("NEWS_RECENT_DAYS", 3);

        const rssCacheDir = path.join(process.cwd(), "core", "news-scraper", ".cache", "rss");
        try { await fs.promises.mkdir(rssCacheDir, { recursive: true }); } catch (e) {}

        let rssCacheNoChange = false;

        if ((site as any).rss) {
          const rssUrls = await scraper.discoverFromRSS((site as any).rss);
          discoveredBySource.rss = rssUrls.length;
          articleUrls.push(...rssUrls);

          // RSS cache: skip further discovery if RSS didn't change
          try {
            const hostname = new URL(site.url).hostname.replace(/[^a-z0-9.-]/gi, "_");
            const cachePath = path.join(rssCacheDir, `${hostname}.json`);
            let prev: string[] = [];
            try {
              const txt = await fs.promises.readFile(cachePath, "utf8");
              prev = JSON.parse(txt || "[]");
            } catch (e) {
              prev = [];
            }

            const prevTop = new Set((prev || []).slice(0, MAX_FIRECRAWL_DISCOVER));
            const newItems = rssUrls.filter((u) => !prevTop.has(u));
            const shouldSkip = prev.length > 0 && newItems.length === 0;
            if (shouldSkip) {
              console.log(`[Discovery RSS Cache] No new RSS items for ${site.url}, skipping all extra discovery`);
              rssCacheNoChange = true;
            }

            await fs.promises.writeFile(cachePath, JSON.stringify(rssUrls.slice(0, MAX_FIRECRAWL_DISCOVER)), "utf8").catch(() => {});
          } catch (e) {}
        }

        if (!rssCacheNoChange && articleUrls.length === 0) {
          console.log(`[Discovery Fallback 1] RSS trống. Cào link động bằng HTML cho ${site.url}...`);
          const htmlUrls = await scraper.discoverLinksWithCheerio(site.url);
          discoveredBySource.html = htmlUrls.length;
          articleUrls.push(...htmlUrls);
        }

        if (!rssCacheNoChange && (articleUrls.length === 0 || alwaysMap)) {
          const recentCount = await db.countRecentArticles(site.url, RECENT_DAYS);
          if (!alwaysMap && recentCount >= FIRECRAWL_SKIP_RECENT_COUNT) {
            console.log(`[Discovery Firecrawl] Bỏ qua ${site.url}: has ${recentCount} recent articles`);
          } else {
            console.log(`[Discovery Fallback 2] Gọi Firecrawl Map cho ${site.url}...`);
            const mappedUrls = await scraper.discoverArticles(site.url, MAX_FIRECRAWL_DISCOVER);
            discoveredBySource.firecrawl = mappedUrls.length;
            articleUrls.push(...(mappedUrls || []));
          }
        }

        articleUrls = sortNewestFirst(uniquePreserveOrder(articleUrls));

        if (articleUrls.length === 0) {
          results.push({ siteUrl: site.url, status: "skipped", message: "No article URLs" });
          continue;
        }

        const existingUrls = await db.findExistingArticleUrls(articleUrls);
        const pendingBeforeCap = stopAtFirstExisting
          ? takeUntilFirstExisting(articleUrls, existingUrls)
          : articleUrls.filter((u) => !existingUrls.has(u));
        const pendingUrls = pendingBeforeCap.slice(0, maxArticlesPerSite);

        if (pendingUrls.length === 0) {
          results.push({
            siteUrl: site.url,
            status: "skipped",
            message: "Newest discovered articles already scraped",
            discovered: articleUrls.length,
            discoveredBySource,
            existing: existingUrls.size,
          });
          continue;
        }

        let savedCount = 0;
        let quantEligibleCount = 0;
        let noTokenCount = 0;
        let errorCount = 0;

        await mapLimit(pendingUrls, concurrency, async (articleUrl) => {
          try {
            const scraped = await scraper.scrapeArticle(articleUrl);

            const fullText = [scraped.title, scraped.summary, scraped.content].filter(Boolean).join("\n");

            const detectedTokens = detectTokenSymbols(fullText, tokenMatchers);
            if (detectedTokens.length === 0) noTokenCount++;
            else quantEligibleCount++;

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
            errorCount++;
            const errMsg = err instanceof Error ? err.message : String(err);
            console.log(`[Bộ lọc] Đã bỏ qua bài viết ${articleUrl}: ${errMsg}`);
            if (errMsg.includes("FATAL_FIRECRAWL_OUT_OF_CREDITS")) throw err;
            return "error";
          }
        });

        await db.updateNewsSiteContent(String(site._id), `saved ${savedCount} articles`);
        results.push({
          siteUrl: site.url,
          status: "saved",
          count: savedCount,
          quantEligible: quantEligibleCount,
          noToken: noTokenCount,
          errors: errorCount,
          discovered: articleUrls.length,
          discoveredBySource,
          existing: existingUrls.size,
          pending: pendingBeforeCap.length,
          attempted: pendingUrls.length,
          capped: pendingBeforeCap.length > pendingUrls.length,
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
