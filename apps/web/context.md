### 1. Mục đích thư mục

`apps/web` là Next.js 14 application cho dashboard Web3 signal/trading. Nó vừa render UI vừa cung cấp API routes đọc/ghi MongoDB.

### 2. Thành phần bên trong

- `app`: pages, layouts, API routes, components, contexts.
- `hooks`: hook cũ như `useData`, `useWalletBalance`.
- `lib`: API client/config, constants, demo scenario, hooks, analytics utilities, semantic normalization.
- `models`: local Mongoose models `Proposal`, `Signal`, `Trade`, `User`.
- `services`: service wrapper như `SignalService`.
- `package.json`: scripts `dev`, `build`, `start`, `lint`; dependencies Next, React, Mongoose, wallet adapter, Recharts, lucide.

### 3. Luồng hoạt động

Client pages dùng hooks trong `lib/hooks`. Hooks gọi `/api/signals`, `/api/proposals`, `/api/portfolio`, `/api/trade/execute`. API routes query MongoDB, sau đó trả về DTO đã normalize. UI không nhận raw quant hoàn toàn; nó nhận thêm semantic fields như `backtest`, `layerConflict`, `signalHealth`, `rationaleBadges`.

### 4. Dependency

- Dùng `@/*` alias theo `tsconfig`.
- Dùng `@gr2/shared` nhưng vẫn có models local.
- Wallet flow dùng Solana wallet adapter.
- Chart/analytics dùng Recharts và local utility `signalAnalytics`.

### 5. Logic quan trọng

- `/api/signals` enrich signal bằng proposal theo `signalId`.
- `/api/proposals/[id]` fallback: nếu không tìm thấy proposal thì tìm signal cùng id và trả `signal-only`.
- `/api/trade/execute` tạo demo trade execution và `perp_positions`, rồi set proposal `EXECUTED`.
- `useSignals` và `useProposals` fallback sang `demoScenario` nếu backend trống/lỗi.

### 6. Rủi ro / vấn đề

- Demo fallback khiến production UI có thể hiển thị dữ liệu giả khi API lỗi.
- `usePortfolio` trong `lib/hooks` vẫn TODO/mock, trong khi `positions/page.tsx` gọi API thật.
- API routes thiếu chuẩn hóa authentication tập trung; một số route tin vào wallet/userId body.
- Một số status casing trộn `pending`, `ACTIVE`, `EXECUTED`, `PENDING`.

### 7. Cách cải thiện

- Tách demo mode khỏi error fallback production; chỉ bật bằng env rõ ràng.
- Gom tất cả route DB access vào repository/service.
- Viết DTO type chung cho Signal/Proposal response.
- Thêm middleware auth/wallet verification cho route ghi như decision/trade.

