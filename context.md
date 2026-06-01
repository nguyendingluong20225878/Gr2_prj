### 1. Mục đích thư mục

Root là monorepo cho hệ thống Web3 signal analytics và trading decision. Sản phẩm gom dữ liệu Twitter/X, news, token price, chạy quant signal detector, tạo proposal bằng Layer 3 LLM, backtest PnL, rồi hiển thị qua Next.js dashboard.

### 2. Thành phần bên trong

- `apps/web`: frontend Next.js App Router và API routes dùng MongoDB/Mongoose.
- `core/shared`: package dùng chung cho DB connection, Mongoose schemas, logger, constants, types.
- `core/signal-detector`: quant core. Nhận tweet/news đã format, gọi FinBERT, weight, aggregate, alpha normalization, xuất signal.
- `core/layer3`: LangGraph/Gemini reasoning layer. Đọc signal RAW, lấy nội dung nguồn, tạo rationale/proposal.
- `core/news-scraper`: scraper news bằng RSS, HTML/Cheerio, Firecrawl fallback, detect token trong nội dung.
- `core/x-scaper`: Selenium X scraper, lưu tweet và engagement vào MongoDB.
- `core/token-price-fetcher`: cập nhật giá realtime và lịch sử từ CoinGecko.
- `core/research/backtest`: đánh giá proposal/signal bằng giá tương lai, PnL, win rate, drawdown, HPO.
- `core/run`: master cron điều phối signal-detector và layer3.
- `package.json`, `turbo.json`, `tsconfig.json`: workspace, build/test orchestration, TypeScript path alias.
- `PROJECT_CONTEXT.md`, `PROJECT_OVERVIEW.md`: mô tả ý tưởng pipeline, nhưng có vài chỗ lệch so với code hiện tại.

### 3. Luồng hoạt động

Input chính là dữ liệu ngoài: X accounts, news sites, token metadata, price data. Pipeline lưu raw data vào MongoDB. `signal-detector` đọc tweet/news/token, tạo signal và lưu collection `signals`. `layer3` đọc signal `RAW`, enrich bằng content nguồn, gọi Gemini, upsert proposal vào `proposals`, đổi signal sang `PROCESSED`. `apps/web` đọc `signals`, `proposals`, `token_prices`, `perp_positions`, `users` để render dashboard, signal list, alerts, proposal detail, positions.

### 4. Dependency

- Root scripts dùng npm workspaces và Turbo.
- `@gr2/shared` là dependency lõi của hầu hết package.
- `@gr2/signal-detector` phụ thuộc `@gr2/shared` để load hyperparameter và save signal.
- `@gr2/proposal-generator` phụ thuộc `@gr2/shared`, `@langchain/langgraph`, Gemini API qua `fetch`.
- `apps/web` phụ thuộc `@gr2/shared` nhưng cũng định nghĩa model Mongoose riêng trong `apps/web/models`.
- `core/run` phụ thuộc các core package và gọi script bằng `execSync`.

### 5. Logic quan trọng

Hệ thống tách vai trò:

- Quant layer tạo `quantScore`, `suggestionType`, `confidence`.
- Layer 3 chỉ viết rationale và mirror quyết định từ signal, không tự tính lại score.
- Backtest đánh giá outcome sau khi proposal có horizon/expiry và giá lịch sử.
- UI dùng semantic adapter để gắn backtest, conflict, health, volatility vào từng signal/proposal.

Công thức lõi nằm ở `core/signal-detector` và `core/research/backtest`; xem thêm `core/signal-detector/logic.md` và `core/research/backtest/logic.md`.

### 6. Rủi ro / vấn đề

- Worktree đang có nhiều file modified/deleted/untracked; tài liệu này phản ánh code hiện tại, không phải trạng thái clean.
- `apps/web` và `core/shared` có schema Signal/Proposal riêng, dễ drift field name.
- Một số `.env` tồn tại trong repo; cần kiểm tra secret hygiene.
- `node_modules`, `dist`, `.turbo`, tsbuildinfo tồn tại trong workspace; không nên coi là source of truth.
- Root `package.json` khai báo TypeScript/Turbo lặp version ở dependencies và devDependencies.

### 7. Cách cải thiện

- Chuẩn hóa schema contract bằng một package shared types hoặc generated DTO cho web API.
- Tách pipeline orchestration khỏi `execSync` string command, dùng direct imports/job runner có telemetry.
- Thêm CI typecheck/test theo workspace, đặc biệt `apps/web` vì có route/UI adapter phức tạp.
- Không commit `.env`, generated `dist`, `node_modules`, `.turbo`, `tsconfig.tsbuildinfo`.

