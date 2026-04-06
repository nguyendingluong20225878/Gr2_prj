import FirecrawlApp from "@mendable/firecrawl-js";

export type ScrapedNewsArticle = {
  siteUrl: string;
  articleUrl: string;
  title: string;
  summary: string;
  content: string;
  publishedAt?: Date | null;
  raw: unknown;
};

/* =========================
   🧠 CONTENT PROCESSING
========================= */

function extractMainContent(md: string): string {
  if (!md) return "";

  const start = md.indexOf("# ");

  // Normalize helpers: Cointelegraph sometimes uses NBSP or different casing.
  const normalizeForSearch = (s: string) =>
    s
      .replace(/\u00a0/g, " ") // NBSP -> space
      .toLowerCase();

  const endMarkers = [
    "More For You",
    // Cointelegraph / others often use these section break labels
    "Read more:",
    "Read more",
    "READ MORE",
    "Read More",
  ];

  let end = md.length;

  for (const marker of endMarkers) {
    // Case-insensitive search over normalized text
    const idx = normalizeForSearch(md).indexOf(normalizeForSearch(marker));
    if (idx !== -1 && idx > start) {
      end = Math.min(end, idx);
    }
  }

  return start !== -1 ? md.slice(start, end) : md;
}

function cleanContent(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\$\d+[,\d.]*/g, "")
    .replace(/Share this article[\s\S]*?\n/g, "")
    .replace(/[•●▪]/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

/* =========================
   🔍 URL FILTER
========================= */

function isValidArticleUrl(url: string): boolean {
  return (
    (
      url.includes("/markets/") ||
      url.includes("/business/") ||
      url.includes("/tech/") ||
      url.includes("/policy/") ||
      url.includes("/news/")
    ) &&
    !url.includes("/fr/") &&
    !url.includes("/es/") &&
    !url.includes("sitemap") &&
    !url.includes("feed") &&
    !url.includes("/tag/") &&
    !url.includes("/author/") &&
    !url.includes("/price/") &&
    !url.endsWith(".xml")
  );
}

/* =========================
   🚀 SCRAPER
========================= */

export class NewsScraper {
  private app: FirecrawlApp;

  constructor(apiKey: string) {
    this.app = new FirecrawlApp({ apiKey });
  }

  /* =========================
     STEP 1: DISCOVERY
  ========================= */

  async discoverArticles(siteUrl: string): Promise<string[]> {
    try {
      const res = await this.app.mapUrl(siteUrl, { limit: 30 });

      if (!res.success) {
        throw new Error(res.error);
      }

      const urls: string[] = res.links ?? [];

      return [...new Set(urls.filter(isValidArticleUrl))];
    } catch (err) {
      console.error(`Discover error ${siteUrl}`, err);
      return [];
    }
  }

  async discoverFromRSS(rssUrl: string): Promise<string[]> {
    try {
      const res = await fetch(rssUrl);
      const xml = await res.text();

      const matches = [...xml.matchAll(/<link>(.*?)<\/link>/g)];

      return matches
        .map((m) => m[1])
        .filter((url) => isValidArticleUrl(url));
    } catch (err) {
      console.error("RSS error:", err);
      return [];
    }
  }

  /* =========================
     STEP 2: SCRAPE (RETRY)
  ========================= */

  async scrapeArticle(articleUrl: string): Promise<ScrapedNewsArticle> {
    const MAX_RETRY = 2;

    for (let i = 0; i < MAX_RETRY; i++) {
      try {
        const res = await this.app.scrapeUrl(articleUrl, {
        
          formats: ["markdown"],
          timeout: 20000,
          waitFor: 2000,
        });

        if (!res.success) throw new Error(res.error);

        /* CLEAN PIPELINE */
        const raw = res.markdown ?? "";
        const main = extractMainContent(raw);
        const content = cleanContent(main);

        if (!content || content.length < 200) {
          throw new Error("Content too short");
        }

        /* METADATA */
        const meta = res.metadata as any;

        const title = meta?.title ?? "";
        const summary = meta?.description ?? "";

        const publishedRaw =
          meta?.publishedTime ?? meta?.published_at ?? null;

        const publishedAt = publishedRaw
          ? new Date(publishedRaw)
          : null;

        return {
          siteUrl: articleUrl,
          articleUrl,
          title,
          summary,
          content,
          publishedAt:
            publishedAt && !Number.isNaN(publishedAt.getTime())
              ? publishedAt
              : null,
          raw: res,
        };
      } catch (err) {
        console.error(`Scrape error ${articleUrl} attempt ${i + 1}`);

        if (i === MAX_RETRY - 1) throw err;

        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    throw new Error("Unreachable");
  }
}