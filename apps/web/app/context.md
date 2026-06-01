### 1. Mục đích thư mục

`app` là Next.js App Router surface: UI pages, server API routes, shared layout, global CSS, contexts, and components.

### 2. Thành phần bên trong

- `api`: backend-for-frontend endpoints.
- `components`: layout, analytics, proposal, portfolio, wallet, shadcn-like UI atoms.
- `contexts`: `AuthContext`, `TradingDemoContext`.
- `overview`, `signals`, `alerts`, `positions`, `portfolio`, `proposal/[id]`, `tokens/[symbol]`, `profile`, `onboarding`: pages.
- `layout.tsx`, `page.tsx`, `globals.css`: app shell, landing/root, styling.

### 3. Luồng hoạt động

User vào app shell, `Layout`/`Navbar` điều hướng. Các màn chính dùng client components và hooks. API routes chạy server-side trong cùng Next app và kết nối MongoDB.

### 4. Dependency

Pages phụ thuộc analytics hooks, semantic utils, wallet context, demo trading context. Components phụ thuộc Tailwind CSS và lucide icons.

### 5. Logic quan trọng

`overview` là command center, `signals` là signal workbench, `alerts` biến analytics row thành risk alerts, `proposal/[id]` là decision/execution detail, `positions` theo dõi open perp positions.

### 6. Rủi ro / vấn đề

- Có thư mục `app/dashboard` nhưng `dashboard/page.tsx` đang deleted trong git status.
- Một số page render text tiếng Việt/English lẫn nhau.
- `overview/page.tsx` hiện có đoạn JSX đáng nghi với `</div>` dư trong map card theo nội dung đọc được; cần typecheck xác nhận.

### 7. Cách cải thiện

Chạy `npm --workspace @gr2/web run build`/typecheck, xóa route chết, thống nhất language/copy, và gom UI decision-state logic vào một module có test.

