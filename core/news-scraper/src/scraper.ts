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

/**
 * ==================================================
 * LỚP 1: CHẶT ĐẦU (Diệt Ticker, Menu, Ads Header)
 * ==================================================
 */
function cutBeforeTitle(content: string, title: string): string {
  if (!title || !content) return content;
  try {
    const cleanTitleWords = title
      .replace(/[^\p{L}\p{N}\s]/gu, " ") 
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0);
       
    if (cleanTitleWords.length < 3) return content; 

    const regexStr = cleanTitleWords.join("[^\\p{L}\\p{N}]{1,40}");
    const regex = new RegExp(regexStr, "iu");
    
    const match = content.match(regex);
    if (match && match.index !== undefined) {
       return content.slice(match.index); 
    }
  } catch (e) {
  }
  return content;
}

function cleanUrl(rawUrl: string): string {
  try {
    const urlObj = new URL(rawUrl);
    urlObj.search = ""; 
    urlObj.hash = "";   
    return urlObj.toString();
  } catch {
    return rawUrl;
  }
}

function isValidArticleUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    if (urlObj.pathname === "/" || urlObj.pathname === "") return false;

    const urlLower = url.toLowerCase();
    
    const isExcluded = 
      urlLower.includes("/learn/") ||
      urlLower.includes("/opinion/") ||
      urlLower.includes("/amp/") ||
      urlLower.endsWith("/amp") ||
      urlLower.includes("/fr/") || 
      urlLower.includes("/es/") || 
      urlLower.includes("sitemap") || 
      urlLower.includes("feed") || 
      urlLower.includes("/tag/") || 
      urlLower.includes("/author/") || 
      urlLower.includes("/price/") || 
      urlLower.endsWith(".xml");

    const isStaticFile = urlLower.match(/\.(xml|json|png|jpg|jpeg|gif|css|js|pdf)$/);

    return !isExcluded && !isStaticFile;
  } catch {
    return false;
  }
}

/**
 * ==================================================
 * LỚP 2: CHẶT ĐUÔI (Diệt "More For You", Footer)
 * ==================================================
 */
function extractMainContent(md: string): string {
  if (!md) return "";

  // 🚀 [FIX]: Do Lớp 1 đã chặt đầu, nội dung chính bắt đầu ngay tại index 0. Bỏ tìm "# "
  const start = 0;
  const normalizeForSearch = (s: string) => s.replace(/\u00a0/g, " ").toLowerCase();

  const endMarkers = [
    "### Recommended News",
    "Recommended News",
    "Daily Debrief Newsletter",
    "View on Walrus",
    "More For You",
    "Read more:",
    "READ MORE",
    "Disclaimer: The Block is an independent"
  ];

  let end = md.length; 
  
  for (const marker of endMarkers) {
    const idx = normalizeForSearch(md).indexOf(normalizeForSearch(marker));
    if (idx !== -1 && idx > start) {
      end = Math.min(end, idx);
    }
  }

  return md.slice(start, end).trim();
}

/**
 * ==================================================
 * LỚP 3: DỌN DẸP (Kẻ Hủy Diệt Rác Nội Dụng)
 * ==================================================
 */
function cleanContent(md: string): string {
  let cleaned = md
    .replace(/!\[[\s\S]{0,200}?\]\([\s\S]{0,200}?\)/g, "") 
    .replace(/\[([\s\S]{0,200}?)\]\([\s\S]{0,200}?\)/g, "$1") 
    .replace(/https?:\/\/\S+/g, "") 
    .replace(/Share this article[^\n]*\n/g, ""); 

  cleaned = cleaned.replace(/(?:Twitter Embed|Visit this post on X)[\s\S]{1,1500}?(?:Copy link|Read [\d,]+ replies|X Ads info and privacy)[^\n]*/gi, "");
  cleaned = cleaned.replace(/(?:[^\n]*?(?:YouTube|Tap to unmute)\n)[\s\S]{1,300}?(?:Watch on|subscribers)[^\n]*/gi, "");
  cleaned = cleaned.replace(/(?:Continue|Sign in|Log in)?\s*with (?:Google|Facebook|Apple|Email)[\s\S]{1,300}?(?:Terms of Service|Privacy Policy)[\s\S]{1,150}?(?:Sign up(?: for free)?|Continue|Agree|Accept)[^\n]*/gi, "");
  cleaned = cleaned.replace(/(?:[^\n]{1,100}\n+){0,3}?(?:###\s*[^\n]+\n+)?[\s\S]{1,800}?(?:profit from predicting|predicting future events|Points and USD.*?markets|depending on your country)[\s\S]{1,200}?(?:Continue|Sign up|Play Now)[^\n]*/gi, "");
  cleaned = cleaned.replace(/(?:^|\n)#{2,4}\s+[^\n]+\n+(?:[^\n]+\n+){0,4}?[^\n]{10,600}?(?:…|\.\.\.)\s*(?=\n|$)/g, "");
  cleaned = cleaned.replace(/(?:Privacy Policy[\s·|•\-]+Terms & Conditions|Terms of Service[\s·|•\-]+Privacy Policy)/gi, "");
  cleaned = cleaned.replace(/(?:###\s*)?[^\n]{1,30}[\s\n]+\$[\d,.]+[\s\n]+[-+]?[\d,.]+\s*%/gi, "");
  cleaned = cleaned.replace(/#\s*(?:Coin Prices|Market Data|Crypto Prices)\s*\n+/gi, "");

  cleaned = cleaned.replace(/The Decrypt News roundup[\s\S]{1,300}?(?:Terms & Conditions|Copy link)/gi, "");
  cleaned = cleaned.replace(/Price data by[\s\S]{1,300}?Reading/gi, "");
  cleaned = cleaned.replace(/Log in or Sign up[\s\S]{1,300}?(?:Continue with Google|OR)/gi, "");
  cleaned = cleaned.replace(/More Videos[\s\S]{1,300}?This video file cannot be played[^\n]*/gi, "");
  cleaned = cleaned.replace(/Press shift question mark[\s\S]{1,300}?Increase Caption Size[^\n]*/gi, "");
  cleaned = cleaned.replace(/Keyboard ShortcutsEnabledDisabled[\s\S]{1,300}?Seek %0-9/gi, "");

  return cleaned
    .replace(/[•●▪]/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

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
    
    $(
      'script, style, nav, footer, header, aside, .ad, .advertisement, ' +
      '[class*="ticker"], [id*="ticker"], [class*="price"], ' +
      '[class*="sidebar"], [class*="widget"], .social-share, ' +
      '[class*="related"], [id*="related"], [class*="recommend"], [class*="promo"], ' +
      '[class*="newsletter"], [data-component="Recommended"], [data-component="Related"]'
    ).remove();
    
    const title = $('h1').first().text().trim() || $('title').text().trim();
    const container = $('article').length > 0 ? $('article') : ($('main').length > 0 ? $('main') : $('body'));
    
    let contentParts: string[] = [];
    
    container.find('p, h2, h3, h4, h5, h6, blockquote, li').each((_, el) => {
      const text = $(el).text().trim();
      const isCryptoTicker = /^([A-Z]{2,6}|[^\x00-\x7F]{2,10})[:\s]*\$?[\d,]+(\.\d+)?/.test(text);
      if (text && text.length > 10 && !isCryptoTicker) {
        contentParts.push(text);
      }
    });
    
    let content = contentParts.join('\n\n');
    
    if (title && content.includes(title)) {
      const startIndex = content.indexOf(title);
      content = content.slice(startIndex + title.length);
    }
    
    content = content.replace(/\n{2,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();

    const jsonLdDate = $('script[type="application/ld+json"]')
      .map((_, el) => $(el).text())
      .get()
      .join("\n")
      .match(/"(?:datePublished|dateCreated|uploadDate)"\s*:\s*"([^"]+)"/i)?.[1];

    const publishedTime =
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="date"]').attr('content') ||
      $('meta[name="pubdate"]').attr('content') ||
      $('meta[name="parsely-pub-date"]').attr('content') ||
      $('meta[property="og:published_time"]').attr('content') ||
      $('meta[property="og:article:published_time"]').attr('content') ||
      $('time[datetime]').first().attr('datetime') ||
      $('[datetime]').first().attr('datetime') ||
      jsonLdDate;

    if (content.length > 600) {
      return { title, content: content.slice(0, 50000), metaData: { publishedTime } };
    }
  } catch (e) {
    return null;
  }
  return null;
}

function extractPublishedDate(articleUrl: string, contentText: string, metaData?: any): Date | null {
  let publishedAt: Date | null = null;

  const rawMeta =
    metaData?.publishedTime ||
    metaData?.published_at ||
    metaData?.datePublished ||
    metaData?.dateCreated ||
    metaData?.["article:published_time"] ||
    metaData?.["og:published_time"] ||
    metaData?.["og:article:published_time"] ||
    metaData?.date;
  if (rawMeta) {
    const normalizedMeta =
      typeof rawMeta === "string" && !rawMeta.endsWith("Z") && !rawMeta.match(/[+-]\d{2}:\d{2}$/)
        ? rawMeta + "Z"
        : rawMeta;

    const parsed = new Date(normalizedMeta);
    if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
  }

  const headText = contentText.slice(0, 20000);

  if (!publishedAt) {
    const dateRe = /(?:Published\s*)?(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z.]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})|(?:\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z.]*\s+\d{4})/i;
    const mDate = dateRe.exec(headText);
    if (mDate) {
      const cleanDate = mDate[0]
        .replace(/^Published\s*/i, "")
        .replace(/(st|nd|rd|th)/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      const parsed = new Date(`${cleanDate} UTC`);
      if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
    }
  }
  
  if (!publishedAt) {
    const urlDateRe = /\/(\d{4})\/(\d{2})\/(\d{2})\//;
    const mUrl = urlDateRe.exec(articleUrl);
    if (mUrl) {
       const parsed = new Date(`${mUrl[1]}-${mUrl[2]}-${mUrl[3]}T12:00:00Z`);
       if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
    }
  }

  if (!publishedAt) {
    const isoMatch = headText.match(/\d{4}-\d{2}-\d{2}/);
    if (isoMatch) {
      const parsed = new Date(isoMatch[0]);
      if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
    }
  }

  return publishedAt;
}

export class NewsScraper {
  private app: FirecrawlApp;

  constructor(apiKey: string) {
    this.app = new FirecrawlApp({ apiKey });
  }

  async discoverLinksWithCheerio(siteUrl: string): Promise<string[]> {
    try {
      const { data } = await axios.get(siteUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
      });
      
      const $ = cheerio.load(data);
      const urls = new Set<string>();

      $('a[href]').each((_, el) => {
        let href = $(el).attr('href');
        if (href) {
          try {
            const fullUrl = new URL(href, siteUrl).toString();
            urls.add(cleanUrl(fullUrl));
          } catch (e) {
          }
        }
      });

      return Array.from(urls).filter(isValidArticleUrl).slice(0, 20);
    } catch (e) {
      console.log(`[Discovery HTML] Không lấy được link từ ${siteUrl}: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  async discoverArticles(siteUrl: string): Promise<string[]> {
    try {
      const res = await this.app.mapUrl(siteUrl, { limit: 130 });
      if (!res.success) throw new Error(res.error);
      
      const urls: string[] = res.links ?? [];
      const cleanedUrls = urls.map(cleanUrl).filter(isValidArticleUrl);
      return [...new Set(cleanedUrls)];
    } catch (err) {
      console.log(`[Discovery Firecrawl] Không map được ${siteUrl}: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  async discoverFromRSS(rssUrl: string): Promise<string[]> {
    try {
      const res = await fetch(rssUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "application/rss+xml, application/xml, text/xml",
        },
      });

      if (!res.ok) {
        console.log(`[Discovery RSS] RSS trả status ${res.status} cho ${rssUrl}`);
        return [];
      }
      
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

      return Array.from(urls).filter(isValidArticleUrl);
    } catch (error) {
      console.log(`[Discovery RSS] Không đọc được RSS ${rssUrl}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async scrapeArticle(articleUrl: string): Promise<ScrapedNewsArticle> {
    const MAX_RETRY = 2;
    const cleanArticleUrl = cleanUrl(articleUrl);
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
          finalTitle = cheapData.title;
          metaForDate = cheapData.metaData;
          rawData = { method: "cheerio" }; 

          // 🚀 [FIX LỚN]: Đưa Cheerio qua phễu lọc 3 Lớp (Chặt Đầu -> Chặt Đuôi -> Dọn Rác)
          let step1 = cutBeforeTitle(cheapData.content, finalTitle);
          let step2 = extractMainContent(step1);
          contentToProcess = cleanContent(step2).slice(0, 50000); 

        } else {
          const res = await this.app.scrapeUrl(cleanArticleUrl, {
            formats: ["markdown"], 
            timeout: 30000,        
            waitFor: 3000,         
            mobile: false          
          });

          if (!res.success) throw new Error(res.error);

          metaForDate = res.metadata as any;
          finalTitle = metaForDate?.title ?? "";
          finalSummary = metaForDate?.description ?? "";
          rawData = res;

          // 🚀 Đưa Firecrawl qua đúng phễu lọc tương tự
          const raw = res.markdown ?? "";
          let step1 = cutBeforeTitle(raw, finalTitle);
          let step2 = extractMainContent(step1);
          contentToProcess = cleanContent(step2).slice(0, 50000); 
        }

        if (!contentToProcess || contentToProcess.length < 200) {
          throw new Error("Content too short");
        }

        let publishedAt = extractPublishedDate(cleanArticleUrl, contentToProcess, metaForDate);

        if (!publishedAt && rawData?.method === "cheerio") {
          const res = await this.app.scrapeUrl(cleanArticleUrl, {
            formats: ["markdown"],
            timeout: 30000,
            waitFor: 3000,
            mobile: false
          });

          if (!res.success) throw new Error(res.error);

          metaForDate = res.metadata as any;
          finalTitle = metaForDate?.title ?? finalTitle;
          finalSummary = metaForDate?.description ?? finalSummary;
          rawData = res;

          const raw = res.markdown ?? "";
          let step1 = cutBeforeTitle(raw, finalTitle);
          let step2 = extractMainContent(step1);
          contentToProcess = cleanContent(step2).slice(0, 50000);
          publishedAt = extractPublishedDate(cleanArticleUrl, raw || contentToProcess, metaForDate);
        }

        if (publishedAt) {
          const now = new Date();
          const diffMs = now.getTime() - publishedAt.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          
          const FUTURE_TOLERANCE_MS = 12 * 60 * 60 * 1000;
          if (diffMs < -FUTURE_TOLERANCE_MS) {
            throw new Error(`Future article detected (publishedAt: ${publishedAt.toISOString()}). Skipping...`);
          }

          const maxDays = 5;
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
