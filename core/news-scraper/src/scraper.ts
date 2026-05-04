import FirecrawlApp from "@mendable/firecrawl-js";
import { XMLParser } from "fast-xml-parser";

export type ScrapedNewsArticle = {
  siteUrl: string;
  articleUrl: string;
  title: string;
  summary: string;
  content: string;
  publishedAt?: Date | null;
  raw: unknown;
};

/**
 * Lấy nội dung chính từ Markdown
 */
function extractMainContent(md: string): string {
  if (!md) return "";

  const start = md.indexOf("# ");

  const normalizeForSearch = (s: string) =>
    s
      .replace(/\u00a0/g, " ") // NBSP -> space
      .toLowerCase();

  const endMarkers = [
    "More For You",
    "Read more:",
    "Read more",
    "READ MORE",
    "Read More",
  ];

  let end = md.length; 
  
  for (const marker of endMarkers) {
    const idx = normalizeForSearch(md).indexOf(normalizeForSearch(marker));
    if (idx !== -1 && idx > start) {
      end = Math.min(end, idx);
    }
  }

  // [FIX] Sử dụng Math.max(0, start) để đảm bảo vẫn cắt được footer ngay cả khi không có H1 (# )
  return md.slice(Math.max(0, start), end).trim();
}

/**
 * Làm sạch nội dung, loại bỏ ảnh, link và các block rác video
 */
function cleanContent(md: string): string {
  let cleaned = md
    .replace(/!\[.*?\]\(.*?\)/g, "") // Xóa ảnh
    .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Giữ text, bỏ link
    .replace(/https?:\/\/\S+/g, "") // Xóa url thuần
    .replace(/Share this article[\s\S]*?\n/g, ""); // Xoá block “Share this article”

  // [FIX ISSUE 4]: Tối ưu CPU bằng cách kiểm tra sự tồn tại của chuỗi nhận diện trước khi dùng Regex phức tạp
  // Giúp tránh hiện tượng Catastrophic Backtracking trên các văn bản lớn.
  if (cleaned.includes("More Videos") || cleaned.includes("video file cannot be played")) {
    cleaned = cleaned.replace(/More Videos[\s\S]*?This video file cannot be played[^\n]*/gi, "");
  }

  if (cleaned.includes("Press shift question mark") || cleaned.includes("Increase Caption Size")) {
    cleaned = cleaned.replace(/Press shift question mark[\s\S]*?Increase Caption Size[^\n]*/gi, "");
  }

  if (cleaned.includes("Keyboard Shortcuts") || cleaned.includes("Seek %0-9")) {
    cleaned = cleaned.replace(/Keyboard ShortcutsEnabledDisabled[\s\S]*?Seek %0-9/gi, "");
  }

  return cleaned
    .replace(/[•●▪]/g, "-") // Chuẩn hoá bullet
    .replace(/[ \t]+/g, " ") // Xoá space thừa
    .replace(/\n{2,}/g, "\n\n") // Chuẩn hoá xuống dòng
    .trim();
}

/**
 * Kiểm tra URL hợp lệ để tránh cào các trang tag, author, sitemap
 */
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

export class NewsScraper {
  private app: FirecrawlApp;

  constructor(apiKey: string) {
    this.app = new FirecrawlApp({ apiKey });
  }

  /**
   * Khám phá URL bài viết từ trang chủ/trang danh mục
   */
  async discoverArticles(siteUrl: string): Promise<string[]> {
    try {
      const res = await this.app.mapUrl(siteUrl, { limit: 130 });

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

  /**
   * Lấy danh sách URL bài viết từ RSS feed (Dùng Fast XML Parser)
   */
  async discoverFromRSS(rssUrl: string): Promise<string[]> {
    try {
      const res = await fetch(rssUrl);
      if (!res.ok) return [];
      
      const xmlText = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false });
      const jsonObj = parser.parse(xmlText);

      const urls = new Set<string>();

      const items = jsonObj?.rss?.channel?.item || jsonObj?.feed?.entry || [];
      const itemArray = Array.isArray(items) ? items : [items];

      for (const item of itemArray) {
        if (item.link) {
          const link = typeof item.link === 'string' ? item.link : item.link['@_href'];
          if (link) urls.add(link);
        } else if (item.guid && typeof item.guid === 'string' && item.guid.startsWith("http")) {
          urls.add(item.guid);
        }
      }

      return Array.from(urls);
    } catch (error) {
      console.error(`[RSS Discovery Error] ${rssUrl}:`, error);
      return [];
    }
  }

  /**
   * Cào chi tiết bài viết và trích xuất Metadata
   */
  async scrapeArticle(articleUrl: string): Promise<ScrapedNewsArticle> {
    const MAX_RETRY = 2;

    for (let i = 0; i < MAX_RETRY; i++) {
      try {
        const res = await this.app.scrapeUrl(articleUrl, {
          formats: ["markdown"],
          timeout: 30000,
          waitFor: 3000,
          mobile: false
        });

        if (!res.success) throw new Error(res.error);

        const raw = res.markdown ?? "";
        const main = extractMainContent(raw);
        
        /**
         * [FIX ISSUE 1]: Giới hạn kích thước Content tối đa
         * Cắt bớt content nếu vượt quá 50,000 ký tự để bảo vệ MongoDB BSON limit (16MB)
         * và tối ưu hóa bộ nhớ cho Quant Engine phía sau.
         */
        const content = cleanContent(main).slice(0, 50000);

        if (!content || content.length < 200) {
          throw new Error("Content too short");
        }

        const meta = res.metadata as any;
        const title = meta?.title ?? "";
        const summary = meta?.description ?? "";

        // ==========================================
        // 🕰️ MÔ HÌNH THÁC NƯỚC: TRÍCH XUẤT NGÀY (3 LỚP)
        // ==========================================
        let publishedAt: Date | null = null;

        // Lớp 1: Metadata từ Firecrawl
        const rawMeta = meta?.publishedTime || 
                        meta?.published_at || 
                        meta?.datePublished || 
                        meta?.['article:published_time'] || 
                        meta?.['og:published_time'] || 
                        meta?.date;
        if (rawMeta) {
          const parsed = new Date(rawMeta);
          if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
        }

        const headText = content.slice(0, 1000);

        // Lớp 2: Tìm text ngày tháng trong văn bản
        if (!publishedAt) {
          // [FIX ISSUE 2]: Mở rộng Regex để bắt cả format US (Apr 19, 2026) và EU/ASIA (19 Apr 2026)
          const dateRe = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})|(?:\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4})/i;
          const mDate = dateRe.exec(headText);
          if (mDate) {
            const parsed = new Date(`${mDate[0]} UTC`);
            if (!Number.isNaN(parsed.getTime())) {
              publishedAt = parsed;
            }
          }
        }
        
        // Lớp 3: Tìm từ cấu trúc URL
        if (!publishedAt) {
          const urlDateRe = /\/(\d{4})\/(\d{2})\/(\d{2})\//;
          const mUrl = urlDateRe.exec(articleUrl);
          if (mUrl) {
             // [FIX ISSUE 3]: Dùng T12:00:00Z làm mốc trung vị để giảm thiểu sai số lệch ngày do Timezone
             const parsed = new Date(`${mUrl[1]}-${mUrl[2]}-${mUrl[3]}T12:00:00Z`);
             if (!Number.isNaN(parsed.getTime())) {
               publishedAt = parsed;
             }
          }
        }

        // ==========================================
        // 🛡️ BỘ LỌC THỜI GIAN VÀ CHỐNG TÍN HIỆU TƯƠNG LAI
        // ==========================================
        if (publishedAt) {
          const now = new Date();
          const diffMs = now.getTime() - publishedAt.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          
          // [FIX ISSUE 1]: Chống Look-ahead Bias bằng cách chặn tin từ tương lai.
          // Cho phép sai lệch tối đa 2 giờ (do lệch đồng hồ server/múi giờ chưa đồng bộ hoàn toàn)
          if (diffMs < -2 * 60 * 60 * 1000) {
            throw new Error(`Future article detected (publishedAt: ${publishedAt.toISOString()}). Skipping...`);
          }

          if (diffDays > 3) {
             throw new Error(`Article too old (${diffDays.toFixed(1)} days diff). Skipping...`);
          }
        } else {
          throw new Error(`Cannot find published date. Skipping to ensure data freshness...`);
        }

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
      } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        // Không retry nếu lỗi thuộc về Logic bộ lọc
        if (
          errorMessage.includes("Article too old") ||
          errorMessage.includes("Future article") ||
          errorMessage.includes("Cannot find published date") ||
          errorMessage.includes("Content too short")
        ) {
          throw err; 
        }

        console.error(`Scrape error ${articleUrl} attempt ${i + 1}: ${errorMessage}`);
        if (i === MAX_RETRY - 1) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    throw new Error("Unreachable");
  }
}