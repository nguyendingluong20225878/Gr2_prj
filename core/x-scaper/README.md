# x-scaper

`x-scaper` collects tweets from configured X/Twitter accounts and stores them for signal scoring.

## Responsibilities

- Load target X accounts from MongoDB/shared repositories.
- Log in with Selenium/Chrome using credentials or local cookies.
- Scroll timelines and parse tweet text, timestamps, URLs, retweets, and engagement counts.
- Persist new tweets and update account scrape metadata.

## Structure

```text
core/x-scaper
├── scripts/
│   ├── run-scraper.ts
│   └── run-scraper-single.ts
├── src/
│   ├── scraper.ts      # Selenium/browser scraping logic
│   ├── process.ts      # Batch orchestration
│   ├── db.ts           # DB load/save helpers
│   ├── constant.ts     # URLs, selectors, cookie paths
│   └── index.ts
└── check-env.ts
```

## Commands

```bash
# Run all configured accounts
npm --workspace x-scaper run scraper

# Run single-account scraper
npm --workspace x-scaper run scrape:single
```

The root shortcut is:

```bash
npm run scraper
```

## Environment

Expected variables depend on the scraper setup, but normally include:

```env
MONGODB_URI=mongodb://localhost:27017/gr2
X_USERNAME=...
X_PASSWORD=...
CHROME_BINARY_PATH=/usr/bin/chromium-browser
```

## Operational Notes

- X DOM selectors are brittle; scraper failures often mean the page structure changed or login/cookies expired.
- Cookie files are local runtime state. In containers or CI, mount/persist them intentionally.
- Engagement fields such as replies, reposts, and likes feed downstream weighting in `signal-detector`.
