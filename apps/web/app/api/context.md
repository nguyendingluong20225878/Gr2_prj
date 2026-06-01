### 1. Mục đích thư mục

`app/api` là backend-for-frontend layer. Nó chuyển MongoDB collections thành DTO phù hợp UI và xử lý vài mutation demo như decision audit/trade execution.

### 2. Thành phần bên trong

- `signals/route.ts`: list signals, enrich bằng proposal liên quan.
- `signals/[id]/route.ts`: detail signal theo ObjectId.
- `proposals/route.ts`: list active/pending proposals.
- `proposals/[id]/route.ts`: proposal detail, fallback signal-only.
- `proposals/[id]/decision/route.ts`: ghi audit ENTER/WAIT/REJECT.
- `portfolio/route.ts`: portfolio holdings, open perp positions, watchlist.
- `trade/execute/route.ts`: demo execute trade, tạo `trade_executions` và `perp_positions`.
- `auth`, `user`, `seed`: auth/user bootstrap endpoints.

### 3. Luồng hoạt động

Request vào route handler. Route gọi `connectDB()`, query Mongoose model hoặc raw collection, normalize fields, trả `NextResponse.json`. Mutating routes validate ObjectId/body tối thiểu rồi ghi MongoDB.

### 4. Dependency

Phụ thuộc `@/lib/mongodb`, shared-backed compatibility models in `@/models`, `mongoose`, constants token display, semantic utilities.

### 5. Logic quan trọng

`/api/signals` lấy signalIds, query proposals theo `signalId`, map proposal đầu tiên vào `enrichedProposal`. `layerConflict` so sánh action signal và action proposal. `deriveBacktestSemantics` biến win/loss/PnL thành badge UI.

`/api/proposals/[id]` có ba nhánh: find by proposal id, find by trigger/signal id, fallback `SignalModel.findById(id)`. Điều này giúp click signal id vẫn mở được proposal screen.

`/api/trade/execute` kiểm tra wallet có user, proposal executable, không có position mở trùng, rồi trong một MongoDB transaction sẽ insert execution, insert position, update proposal `EXECUTED`, và ghi decision audit.

`/api/portfolio` không còn hardcode SOL dev price. Nếu thiếu giá, holding trả `price: null`, `value: null`, `dataQuality: MISSING_PRICE`.

### 6. Rủi ro / vấn đề

- `/api/proposals` suy action từ `title` nếu có `short/sell`, có thể override `suggestionType`.
- Một số route vẫn dùng raw `db.collection`, nên vẫn cần DTO validation dù Signal/Proposal model đã chuyển sang shared.

### 7. Cách cải thiện

- Loại bỏ title-based action inference.
- Chuẩn hóa response schema bằng Zod.
- Bổ sung auth guard và rate limit cho mutation endpoints.
