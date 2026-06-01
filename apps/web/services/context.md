### 1. Mục đích thư mục

`services` chứa service wrapper cho Next API, hiện nổi bật là `SignalService`.

### 2. Thành phần bên trong

- `SignalService.ts`: truy vấn signals theo limit/type và có thể normalize/filter dữ liệu cho route `/api/signals`.

### 3. Luồng hoạt động

API route gọi service, service query model/database, route enrich thêm proposal.

### 4. Dependency

Phụ thuộc local model/Mongoose và được route `/api/signals` sử dụng.

### 5. Logic quan trọng

Service giúp tách query signal khỏi route, nhưng enrichment/semantic vẫn nằm ở route.

### 6. Rủi ro / vấn đề

Service layer chưa nhất quán; nhiều API route vẫn tự query raw DB.

### 7. Cách cải thiện

Mở rộng service/repository pattern cho proposals, portfolio, trades để giảm logic lặp trong route handlers.

