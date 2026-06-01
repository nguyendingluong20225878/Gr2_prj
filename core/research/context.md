### 1. Mục đích thư mục

`research` chứa tooling nghiên cứu, hiện có backtest engine cho proposal/signal strategy.

### 2. Thành phần bên trong

- `backtest`: PnL evaluator, proposal backtest, replay hyperparameter optimization.

### 3. Luồng hoạt động

Backtest đọc proposal đã sinh, tìm giá entry/exit từ `token_price_history`, tính PnL/outcome/drawdown, update proposal và `backtest_results`.

### 4. Dependency

Depends on shared schemas, token price service, signal detector for replay.

### 5. Logic quan trọng

Research layer là vòng phản hồi giúp đánh giá signal có tạo lợi nhuận sau phí/slippage hay không.

### 6. Rủi ro / vấn đề

Backtest phụ thuộc chất lượng lịch sử giá. Nếu thiếu giá, proposal bị skip hoặc dùng current fallback nếu được bật.

### 7. Cách cải thiện

Thêm train/validation split nghiêm ngặt, data quality score, và báo cáo per-token/source/horizon.

