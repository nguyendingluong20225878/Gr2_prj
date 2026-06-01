### 1. Mục đích thư mục

`apps` chứa application-facing products. Hiện chỉ có `apps/web`, là Next.js app kiêm backend-for-frontend API.

### 2. Thành phần bên trong

- `web`: App Router pages, API routes, UI components, hooks, Mongoose models, wallet/demo contexts.

### 3. Luồng hoạt động

Browser gọi Next.js page. Client hooks gọi `/api/*`. API routes kết nối MongoDB qua `apps/web/lib/mongodb.ts`, đọc collections bằng Mongoose models hoặc raw `mongoose.connection.db`, normalize dữ liệu trả về UI.

### 4. Dependency

`apps/web` phụ thuộc `@gr2/shared`, Next.js, React, Mongoose, Solana wallet adapter, Recharts, SWR, lucide.

### 5. Logic quan trọng

Ứng dụng web không trực tiếp chạy quant. Nó là presentation/control layer: xem tín hiệu, xem proposal, ghi decision audit, demo execute trade, xem portfolio/positions.

### 6. Rủi ro / vấn đề

API route vừa dùng shared model vừa dùng model local, dễ lệch schema. Một số hook fallback demo có thể che lỗi backend thật.

### 7. Cách cải thiện

Tạo một BFF service layer riêng cho normalize DTO, dùng chung type từ `core/shared`, thêm integration tests cho các route quan trọng.

