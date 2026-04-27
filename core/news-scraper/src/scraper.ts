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

//Lay noi dung chinh
function extractMainContent(md: string): string {
  if (!md) return "";

  const start = md.indexOf("# ");

  // Normalize helpers: Cointelegraph sometimes uses NBSP or different casing.
  const normalizeForSearch = (s: string) =>
    s
      .replace(/\u00a0/g, " ") // NBSP -> space
      //NBSP : Non-breaking space -> 1 kí tự khoảng trắng đặc biệt ngăn trình duyệt xuống dòng 
      //vd: a b -> space giữa nếu đang là 1 NBSP thì sẽ không bị tách dòng.
      .toLowerCase();

  const endMarkers = [
    "More For You",
    // Cointelegraph / others often use these section break labels
    "Read more:",
    "Read more",
    "READ MORE",
    "Read More",
  ];

  let end = md.length; //neu k tim thay marker -> lay toan bo content
  
  //Tìm vị trí của marker trong content
  for (const marker of endMarkers) {
    // Case-insensitive search over normalized text
    const idx = normalizeForSearch(md).indexOf(normalizeForSearch(marker));
    if (idx !== -1 && idx > start) {
      end = Math.min(end, idx);//nhiều marker -> lấy cái gần nhất
    }
  }

  return start !== -1 ? md.slice(start, end) : md;
}

function cleanContent(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, "") // Xóa ảnh
    .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Giữ text, bỏ link
    .replace(/https?:\/\/\S+/g, "") // Xóa url thuần
    // .replace(/\$\d+[,\d.]*/g, "") // GIỮ NGUYÊN COMMENT ĐỂ KHÔNG MẤT SỐ TIỀN
    .replace(/Share this article[\s\S]*?\n/g, "") // Xoá block “Share this article”
    // 👇 3 dòng dưới đây chuyên trị dọn rác Video của Cointelegraph
    .replace(/More Videos[\s\S]*?This video file cannot be played[^\n]*/gi, "")
    .replace(/Press shift question mark[\s\S]*?Increase Caption Size[^\n]*/gi, "")
    .replace(/Keyboard ShortcutsEnabledDisabled[\s\S]*?Seek %0-9/gi, "")
    .replace(/[•●▪]/g, "-") // Chuẩn hoá bullet
    .replace(/[ \t]+/g, " ") // Xoá space thừa
    .replace(/\n{2,}/g, "\n\n") // Chuẩn hoá xuống dòng
    .trim(); // xóa đầu cuối
}

//Lọc url
function isValidArticleUrl(url: string): boolean {
  return (
    (
      url.includes("/markets/") ||
      url.includes("/business/") ||
      url.includes("/tech/") ||
      url.includes("/policy/") ||
      url.includes("/news/")
    ) &&
    !url.includes("/fr/") && //tiếng Pháp
    !url.includes("/es/") && //tiếng TBN
    !url.includes("sitemap") && // sitemap.xml
    !url.includes("feed") && //RSS feed
    !url.includes("/tag/") && //tag
    !url.includes("/author/") && //author
    !url.includes("/price/") && //giá
    !url.endsWith(".xml") //file XMl
  );
}

// SCRAPER


export class NewsScraper {
  private app: FirecrawlApp;//dùng API Firecrawl
  // tên biến : kiểu dlieu

  constructor(apiKey: string) {
    this.app = new FirecrawlApp({ apiKey });
  }


//Tìm bài
 async discoverArticles(siteUrl: string): Promise<string[]> {
    try {
      const res = await this.app.mapUrl(siteUrl, { limit: 130 });
      //mapUrl là một method của Firecrawl SDK (FirecrawlApp)
      //quét siteURL và trả về các url bên trong, tối đa 130 limit

      if (!res.success) {
        throw new Error(res.error);
      }

      const urls: string[] = res.links ?? [];

      return [...new Set(urls.filter(isValidArticleUrl))];
      //filter -> Loại trùng -> convert array 
    } catch (err) {
      console.error(`Discover error ${siteUrl}`, err);
      return [];
    }
  }

 //lấy dsach bài viết từ RSS feed
  async discoverFromRSS(rssUrl: string): Promise<string[]> {
    try {
      const res = await fetch(rssUrl);
      const xml = await res.text();

      // 🚀 BẮT ĐỒNG THỜI CẢ <guid> VÀ <link>
      // Thẻ <guid> của Cointelegraph chứa URL nguyên thủy, sạch 100% không bị dính mã tracking
      const guidMatches = [...xml.matchAll(/<guid[^>]*>([\s\S]*?)<\/guid>/gi)];
      const linkMatches = [...xml.matchAll(/<link>([\s\S]*?)<\/link>/gi)];

      let allUrls = [...guidMatches, ...linkMatches].map((m) => {
         // Làm sạch CDATA
         let cleanUrl = m[1].replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim();
         
         // Fix triệt để: Cắt bỏ mọi tham số theo dõi (?utm_source...)
         const questionMarkIndex = cleanUrl.indexOf("?");
         if (questionMarkIndex !== -1) {
           cleanUrl = cleanUrl.substring(0, questionMarkIndex);
         }
         
         return cleanUrl;
      });

      // Lọc trùng lặp URL và chỉ giữ lại link đúng định dạng bài báo
      allUrls = [...new Set(allUrls)].filter((url) => isValidArticleUrl(url));

      console.log(`[DEBUG RSS] Đã bắt được ${allUrls.length} link bài viết hợp lệ từ ${rssUrl}`);
      return allUrls;
    } catch (err) {
      console.error("RSS error:", err);
      return [];
    }
  }
  //in:url -> out: object chuẩn hóa
  async scrapeArticle(articleUrl: string): Promise<ScrapedNewsArticle> {
    const MAX_RETRY = 2;

    for (let i = 0; i < MAX_RETRY; i++) {
      try {//API scrape trong FireCrawl
       const res = await this.app.scrapeUrl(articleUrl, {
          formats: ["markdown"], //trả về nội dung dạng Markdown
          timeout: 30000,        // Tăng lên 30s cho chắc chắn
          waitFor: 3000,         // CẢI TIẾN: Đợi 3 giây để chống Lazy Load (tránh cụt đuôi)
          mobile: false          // CẢI TIẾN: Giả lập PC để web trả về full text dễ hơn
        });

        if (!res.success) throw new Error(res.error);

        /* CLEAN PIPELINE */
        const raw = res.markdown ?? "";
        const main = extractMainContent(raw);
        const content = cleanContent(main);

        if (!content || content.length < 200) {
          throw new Error("Content too short");
        }

       /* METADATA VÀ TÌM KIẾM NGÀY XUẤT BẢN TỔNG QUÁT (WATERFALL EXTRACTION) */
        const meta = res.metadata as any;
        const title = meta?.title ?? "";
        const summary = meta?.description ?? "";
        const rawMarkdown = res.markdown ?? "";

        // ==========================================
        // 🕰️ MÔ HÌNH THÁC NƯỚC: TRÍCH XUẤT NGÀY (3 LỚP)
        // ==========================================
        let publishedAt: Date | null = null;

        // Lớp 1: Lấy từ Firecrawl Metadata (Mở rộng toàn bộ các thẻ SEO chuẩn)
        const rawMeta = meta?.publishedTime || 
                        meta?.published_at || 
                        meta?.datePublished || 
                        meta?.['article:published_time'] || 
                        meta?.['og:published_time'] || 
                        meta?.['og:article:published_time'] || 
                        meta?.date;
        if (rawMeta) {
          const parsed = new Date(rawMeta);
          if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
        }

        // Lớp 2: Tìm từ URL (Chuyên trị CoinDesk: /2026/04/24/)
        if (!publishedAt) {
          const urlDateMatch = articleUrl.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
          if (urlDateMatch) {
            // urlDateMatch[1] = Năm, [2] = Tháng, [3] = Ngày
            const parsed = new Date(`${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`);
            if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
          }
        }

        // Lớp 3: Tìm trong Nội dung văn bản (🚀 QUÉT TOÀN BỘ VĂN BẢN, BỎ GIỚI HẠN 4000 KÝ TỰ)
        if (!publishedAt && res.markdown) {
          const headText = res.markdown; // Quét 100% nội dung bài báo
          
          // Regex 3.1: Dạng dính chữ của Cointelegraph (VD: PublishedApr 19, 2026 hoặc Published April 19th, 2026)
          const ctMatch = headText.match(/Published\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z\.]*\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4})/i);
          if (ctMatch) {
            // Chỉ lấy đúng Tháng, Ngày, Năm ghép lại -> Vượt qua mọi lỗi định dạng thừa
            const parsed = new Date(`${ctMatch[1]} ${ctMatch[2]}, ${ctMatch[3]}`);
            if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
          }

          // Regex 3.2: Dạng chuẩn (VD: Apr 19, 2026 hoặc April 19th, 2026)
          if (!publishedAt) {
            const standardMatch = headText.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z\.]*\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4}/i);
            if (standardMatch) {
              // Ép khoảng trắng chuẩn và xóa đuôi ordinal (st, nd, rd, th) để Date() không bị lỗi
              const cleanDateStr = standardMatch[0].replace(/\s+/g, " ").replace(/(st|nd|rd|th),/i, ",");
              const parsed = new Date(cleanDateStr);
              if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
            }
          }
          
          // Regex 3.3: Định dạng ISO (VD: 2026-04-24)
          if (!publishedAt) {
            const isoMatch = headText.match(/\d{4}-\d{2}-\d{2}/);
            if (isoMatch) {
              const parsed = new Date(isoMatch[0]);
              if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
            }
          }
        }

        // ==========================================
        // 🛡️ BỘ LỌC THỜI GIAN (CHẶN TIN CŨ VÀ TƯƠNG LAI)
        // ==========================================
        if (publishedAt) {
          const now = new Date();
          const diffMs = Math.abs(now.getTime() - publishedAt.getTime());
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          
          if (diffDays > 3) {
             throw new Error(`Article too old (${diffDays.toFixed(1)} days diff). Skipping...`);
          }
        } else {
          throw new Error(`Cannot find published date from Metadata, Text, or URL. Skipping to ensure data freshness...`);
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
        // Lấy thông báo lỗi
        const errorMessage = err instanceof Error ? err.message : String(err);

        // 🚀 CẢI TIẾN: KHÔNG RETRY VỚI CÁC LỖI DO BỘ LỌC CHỦ ĐỘNG ĐÁ VĂNG
        if (
          errorMessage.includes("Article too old") ||
          errorMessage.includes("Cannot find published date") ||
          errorMessage.includes("Content too short")
        ) {
          throw err; // Ném thẳng ra ngoài cho process.ts xử lý luôn, KHÔNG RETRY!
        }

        // CHỈ RETRY NẾU LÀ LỖI MẠNG HOẶC LỖI FIRE CRAWL
        console.error(`Scrape error ${articleUrl} attempt ${i + 1}`);

        if (i === MAX_RETRY - 1) throw err;

        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    throw new Error("Unreachable");
  }
}