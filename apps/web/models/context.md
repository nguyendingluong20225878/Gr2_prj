### 1. Mục đích thư mục

`models` là compatibility adapter cho Next.js API routes. Sau P0, `Signal.ts` và `Proposal.ts` không còn định nghĩa schema riêng; chúng re-export shared models từ `@gr2/shared`.

### 2. Thành phần bên trong

- `Proposal.ts`: default export `proposalsTable` từ `@gr2/shared`; giữ nguyên import path cũ `@/models/Proposal`.
- `Signal.ts`: export `SignalModel = signalsTable` từ `@gr2/shared`; giữ nguyên import path cũ `@/models/Signal`.
- `Trade.ts`: trade model.
- `User.ts`: user/wallet/balance model.

### 3. Luồng hoạt động

API routes import models qua đường dẫn cũ, nhưng Signal/Proposal model thực tế lấy từ shared schema. Một số route vẫn dùng raw `db.collection`.

### 4. Dependency

Phụ thuộc `@gr2/shared`. Trade/User vẫn là local models.

### 5. Logic quan trọng

Shared schema đã được mở rộng để chứa canonical fields và legacy UI fields như `financialImpact`, `status`, `action`, `triggerSignalId`, `tokenName`, đồng thời có `uncertaintyEntropy`, `realizedVolatility`, `signalMode`.

### 6. Rủi ro / vấn đề

Trade/User vẫn còn local nên vẫn cần kiểm soát contract. Raw collection writes vẫn có thể ghi field ngoài DTO.

### 7. Cách cải thiện

Tiếp tục gom Trade/User hoặc ít nhất DTO response vào `@gr2/shared`/`@gr2/contracts`. Thêm Zod validation ở API boundary.
