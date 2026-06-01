### 1. Mục đích thư mục

`news-scraper` discovers, scrapes, cleans, token-tags, and stores crypto news articles.

### 2. Thành phần bên trong

- `src/scraper.ts`: discovery/scrape/clean logic using RSS, Cheerio, Firecrawl.
- `src/process.ts`: orchestration, token matcher, duplicate filtering, per-site processing.
- `src/db.ts`: shared DB helpers for sites/tokens/articles.
- `scripts/run-news-scraper.ts`: CLI runner.

### 3. Luồng hoạt động

Load news sites and tokens. Discover article URLs from RSS, fallback HTML, fallback Firecrawl map. Remove existing URLs, scrape pending URLs, clean content, detect token symbols in title/summary/content, upsert `news_articles`.

### 4. Dependency

Depends on Firecrawl, axios, cheerio, fast-xml-parser, `@gr2/shared`.

### 5. Logic quan trọng

Token detection builds regex for symbols and names. `NEWS_STOP_AT_FIRST_EXISTING` stops processing after first already-seen newest article. `detectedTokens` is later used by signal-detector; news is not re-scanned there.

### 6. Rủi ro / vấn đề

- Regex token detection can false positive common symbols/names.
- Date extraction has many fallbacks but can still be wrong by timezone/source formatting.
- Content cleaners are site-specific and may remove useful text or leave ads.

### 7. Cách cải thiện

Store scraper version/content quality score. Add per-site parsers for high-value sources. Add tests for token detection false positives.

