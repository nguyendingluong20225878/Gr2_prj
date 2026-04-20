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
    .replace(/!\[.*?\]\(.*?\)/g, "")//Xóa ảnh
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")//Giữ text , bỏ link
    .replace(/https?:\/\/\S+/g, "")//Xóa url thuần
    .replace(/\$\d+[,\d.]*/g, "")//Xóa số tiền
    .replace(/Share this article[\s\S]*?\n/g, "")//Xoá block “Share this article”
    .replace(/[•●▪]/g, "-")//Chuẩn hoá bullet
    .replace(/[ \t]+/g, " ")//Xoá space thừa
    .replace(/\n{2,}/g, "\n\n")//Chuẩn hoá xuống dòng
    .trim();//xóa đầu cuối
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
      const res = await this.app.mapUrl(siteUrl, { limit: 30 });
      //mapUrl là một method của Firecrawl SDK (FirecrawlApp)
      //quét siteURL và trả về các url bên trong, tối đa 30 limit

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

      //Parse link bằng regex
      const matches = [...xml.matchAll(/<link>(.*?)<\/link>/g)];

      return matches
        .map((m) => m[1])
        .filter((url) => isValidArticleUrl(url));
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