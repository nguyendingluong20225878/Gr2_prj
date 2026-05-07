import FirecrawlApp from "@mendable/firecrawl-js";
import { XMLParser } from "fast-xml-parser";
import axios from "axios";
import * as cheerio from "cheerio";

export type ScrapedNewsArticle = {
  siteUrl: string;
  articleUrl: string;
  title: string;
  summary: string;
  content: string;
  publishedAt?: Date | null;
  raw?: any;
};

function cleanUrl(rawUrl: string): string {
  try {
    const urlObj = new URL(rawUrl);
    urlObj.search = ""; // Xóa toàn bộ tham số theo dõi (?utm_source=...)
    urlObj.hash = "";   // Xóa các mỏ neo #...
    return urlObj.toString();
  } catch {
    return rawUrl;
  }
}

// ==========================================
// TỔNG QUÁT: LỌC URL BẰNG BLACKLIST
// ==========================================
function isValidArticleUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  
  // Chỉ chặn những path chắc chắn không phải là tin tức cốt lõi
  const isExcluded = 
    urlLower.includes("/learn/") ||
    urlLower.includes("/opinion/") ||
    urlLower.includes("/fr/") || // Bỏ qua tiếng Pháp
    urlLower.includes("/es/") || // Bỏ qua tiếng TBN
    urlLower.includes("sitemap") || 
    urlLower.includes("feed") || 
    urlLower.includes("/tag/") || 
    urlLower.includes("/author/") || 
    urlLower.includes("/price/") || 
    urlLower.endsWith(".xml");

  // [FIX] Chặn luôn đuôi các file tĩnh để tránh tải nhầm ảnh/tài liệu
  const isStaticFile = urlLower.match(/\.(xml|json|png|jpg|jpeg|gif|css|js|pdf)$/);

  // Chấp nhận mọi URL không nằm trong danh sách đen và không phải file tĩnh
  return !isExcluded && !isStaticFile;
}

// ==========================================
// TỔNG QUÁT: LÀM SẠCH CONTENT (MARKDOWN)
// ==========================================
function extractMainContent(md: string): string {
  if (!md) return "";

  // Lấy mốc bắt đầu là thẻ Heading 1 (# ). Mọi rác trước thẻ H1 sẽ bị vứt bỏ.
  const start = md.indexOf("# ");

  const normalizeForSearch = (s: string) => s.replace(/\u00a0/g, " ").toLowerCase();

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

  return md.slice(Math.max(0, start), end).trim();
}

function cleanContent(md: string): string {
  let cleaned = md
    .replace(/!\[.*?\]\(.*?\)/g, "") // Xóa ảnh
    .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Giữ text, bỏ link
    .replace(/https?:\/\/\S+/g, "") // Xóa url thuần
    .replace(/Share this article[\s\S]*?\n/g, ""); // Dọn rác cơ bản

  // Dọn rác Video của Cointelegraph (nếu có)
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
    .replace(/[•●▪]/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

// ==========================================
// TẦNG CHIẾT XUẤT GIÁ RẺ (CHEERIO)
// ==========================================
async function extractWithCheerio(url: string) {
  try {
    const { data } = await axios.get(url, { 
      timeout: 15000,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
      } 
    });
    
    const $ = cheerio.load(data);
    
    // 1. Gỡ thẻ script, style, nav...
    $('script, style, nav, footer, header, aside, .ad, .advertisement').remove();
    
    // 2. Lấy Title làm mốc
    const title = $('h1').first().text().trim() || $('title').text().trim();
    let content = $('article').text().trim() || $('main').text().trim() || $('body').text().trim();
    
    // 3. CƠ CHẾ TỔNG QUÁT: Tìm vị trí của Title trong cụm content.
    // Xóa sạch toàn bộ văn bản (social share, author tags, v.v) nằm TRƯỚC Title.
    if (title && content.includes(title)) {
      const startIndex = content.indexOf(title);
      // Cắt từ sau Title để lấy nội dung thuần túy
      content = content.slice(startIndex + title.length);
    }
    
    content = content.replace(/\n{2,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();

    // [FIX LỖI THIẾU 1]: Bổ sung việc trích xuất ngày tháng (Metadata Layer 1)
    const publishedTime = 
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="date"]').attr('content') ||
      $('meta[property="og:published_time"]').attr('content');

    if (content.length > 600) {
      return { title, content: content.slice(0, 50000), metaData: { publishedTime } };
    }
  } catch (e) {
    return null;
  }
  return null;
}

// ==========================================
// HÀM HELPER PARSE NGÀY THÁNG
// ==========================================
function extractPublishedDate(articleUrl: string, contentText: string, metaData?: any): Date | null {
  let publishedAt: Date | null = null;

  // Lớp 1: Metadata
  const rawMeta = metaData?.publishedTime || metaData?.published_at || metaData?.datePublished || metaData?.['article:published_time'] || metaData?.date;
  if (rawMeta) {
    const parsed = new Date(rawMeta);
    if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
  }

  const headText = contentText.slice(0, 1000);

  // Lớp 2: Text trong bài
  if (!publishedAt) {
    const dateRe = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})|(?:\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4})/i;
    const mDate = dateRe.exec(headText);
    if (mDate) {
      const parsed = new Date(`${mDate[0]} UTC`);
      if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
    }
  }
  
  // Lớp 3: URL
  if (!publishedAt) {
    const urlDateRe = /\/(\d{4})\/(\d{2})\/(\d{2})\//;
    const mUrl = urlDateRe.exec(articleUrl);
    if (mUrl) {
       const parsed = new Date(`${mUrl[1]}-${mUrl[2]}-${mUrl[3]}T12:00:00Z`);
       if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
    }
  }

  // Lớp 4: ISO Date
  if (!publishedAt) {
    const isoMatch = headText.match(/\d{4}-\d{2}-\d{2}/);
    if (isoMatch) {
      const parsed = new Date(isoMatch[0]);
      if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
    }
  }

  return publishedAt;
}

// ==========================================
// CLASS CHÍNH: NEWS SCRAPER
// ==========================================
export class NewsScraper {
  private app: FirecrawlApp;

  constructor(apiKey: string) {
    this.app = new FirecrawlApp({ apiKey });
  }

  async discoverArticles(siteUrl: string): Promise<string[]> {
    try {
      const res = await this.app.mapUrl(siteUrl, { limit: 130 });
      if (!res.success) throw new Error(res.error);
      
      const urls: string[] = res.links ?? [];
      const cleanedUrls = urls.map(cleanUrl).filter(isValidArticleUrl);
      return [...new Set(cleanedUrls)];
    } catch (err) {
      return [];
    }
  }

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
          if (link) urls.add(cleanUrl(link));
        } else if (item.guid && typeof item.guid === 'string' && item.guid.startsWith("http")) {
          urls.add(cleanUrl(item.guid));
        }
      }

      // Lọc Blacklist
      const finalUrls = Array.from(urls).filter(isValidArticleUrl);
      return finalUrls;
    } catch (error) {
      return [];
    }
  }

  async scrapeArticle(articleUrl: string): Promise<ScrapedNewsArticle> {
    const MAX_RETRY = 2;
    const cleanArticleUrl = cleanUrl(articleUrl);
    
    // Tự động bóc domain gốc
    const siteUrlOrigin = new URL(cleanArticleUrl).origin;

    for (let i = 0; i < MAX_RETRY; i++) {
      try {
        const cheapData = await extractWithCheerio(cleanArticleUrl);
        let contentToProcess = "";
        let finalTitle = "";
        let finalSummary = "";
        let metaForDate = null;
        let rawData: any = null;

        if (cheapData) {
          contentToProcess = cheapData.content;
          finalTitle = cheapData.title;
          metaForDate = cheapData.metaData; // [FIX LỖI THIẾU 1]: Đưa Metadata vào để xử lý ngày tháng
          rawData = { method: "cheerio" }; // Lưu để biết cào bằng cách nào
        } else {
          // Fallback sang Firecrawl
          const res = await this.app.scrapeUrl(cleanArticleUrl, {
            formats: ["markdown"], 
            timeout: 30000,        
            waitFor: 3000,         
            mobile: false          
          });

          if (!res.success) throw new Error(res.error);

          const raw = res.markdown ?? "";
          const main = extractMainContent(raw);
          contentToProcess = cleanContent(main).slice(0, 50000); 
          
          metaForDate = res.metadata as any;
          finalTitle = metaForDate?.title ?? "";
          finalSummary = metaForDate?.description ?? "";
          rawData = res;
        }

        if (!contentToProcess || contentToProcess.length < 200) {
          throw new Error("Content too short");
        }

        const publishedAt = extractPublishedDate(cleanArticleUrl, contentToProcess, metaForDate);

        if (publishedAt) {
          const now = new Date();
          const diffMs = now.getTime() - publishedAt.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          
          if (diffMs < -2 * 60 * 60 * 1000) {
            throw new Error(`Future article detected. Skipping...`);
          }

          const maxDays = 2;
          if (diffDays > maxDays) {
             throw new Error(`Article too old (${diffDays.toFixed(1)} days diff). Skipping...`);
          }
        } else {
          throw new Error(`Cannot find published date. Skipping...`);
        }

        return {
          siteUrl: siteUrlOrigin, 
          articleUrl: cleanArticleUrl,
          title: finalTitle,
          summary: finalSummary,
          content: contentToProcess,
          publishedAt: publishedAt,
          raw: rawData
        };

      } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        // [FIX LỖI THIẾU 2]: THÊM ĐOẠN NÀY ĐỂ NGẮT KHẨN CẤP KHI HẾT TIỀN
        if (errorMessage.includes("402") || errorMessage.includes("Insufficient credits")) {
          throw new Error("FATAL_FIRECRAWL_OUT_OF_CREDITS"); 
        }

        if (
          errorMessage.includes("Article too old") ||
          errorMessage.includes("Future article") ||
          errorMessage.includes("Cannot find published date") ||
          errorMessage.includes("Content too short")
        ) {
          throw err; 
        }
        if (i === MAX_RETRY - 1) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    throw new Error("Unreachable");
  }
}