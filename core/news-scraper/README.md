# @gr2/news-scraper

`core/news-scraper` discovers, scrapes, cleans, token-tags, and stores crypto news articles.

## Responsibilities

- Load configured news sites and known tokens.
- Discover article URLs from RSS, HTML pages, and Firecrawl fallback mapping.
- Skip existing URLs.
- Scrape article content and normalize title, summary, body, source, and published date.
- Detect token symbols/names and persist `detectedTokens` for downstream scoring.

## Structure

```text
core/news-scraper
├── scripts/
│   └── run-news-scraper.ts
└── src/
    ├── scraper.ts      # Discovery, scrape, clean helpers
    ├── process.ts      # Batch orchestration and token matching
    ├── db.ts           # Shared DB helpers
    └── index.ts
```

## Commands

```bash
# Run directly
npm --workspace @gr2/news-scraper run scraper

# Root shortcut
npm run news

# Build
npm --workspace @gr2/news-scraper run build
```

## Environment

```env
MONGODB_URI=mongodb://localhost:27017/gr2
FIRECRAWL_API_KEY=...
NEWS_STOP_AT_FIRST_EXISTING=true
```

`NEWS_STOP_AT_FIRST_EXISTING` can stop a source early after the first already-seen newest article.

## Notes

- Token detection is regex-based and can false-positive common symbols or names.
- Date extraction is source-dependent; check timezone and fallback behavior when adding new sites.
- `detectedTokens` is important: the signal detector trusts this field for news token matching.
