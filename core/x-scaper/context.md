### 1. Mục đích thư mục

`x-scaper` scrapes tweets from configured X accounts and stores tweet content/engagement for quant scoring.

### 2. Thành phần bên trong

- `src/scraper.ts`: Selenium/Chrome driver, login/cookies, timeline scrolling, tweet parsing.
- `src/process.ts`: entrypoint for batch/specific account scraping.
- `src/db.ts`: load accounts, save tweets, update account metadata.
- `src/repositories`: Mongo repositories/factory.
- `src/constant.ts`: selectors/URLs/cookie paths.
- `scripts`: CLI runners.

### 3. Luồng hoạt động

Load credentials, initialize scraper, login via cookie or credentials, iterate accounts, extract tweets until cutoff/safety limits, save new tweets with engagement and retweet metadata.

### 4. Dependency

Depends on Selenium WebDriver, Chrome, dotenv, `@gr2/shared`.

### 5. Logic quan trọng

Engagement fields `replyCount`, `retweetCount`, `likeCount` are critical for quant tweet weight. `saveTweets` deduplicates via Mongo duplicate-key behavior and updates `lastTweetUpdatedAt`.

### 6. Rủi ro / vấn đề

- X DOM selectors are brittle.
- Cookie file is local state and can expire/checkpoint.
- Uses filesystem cookie write/read inside package; operationally fragile in serverless/container environments.

### 7. Cách cải thiện

Move scraping to managed browser worker, add selector health checks, store scrape run metadata and failure causes.

