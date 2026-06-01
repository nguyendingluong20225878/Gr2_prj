### 14. Backtest Results + Proposal PnL Fields Là  Gì?

Đây là bước hậu kiểm sau khi hệ thống đã tạo proposal.

Nói ngắn gọn:

- `signals`: hệ thống nghĩ gì tại thời điểm phát hiện tín hiệu.
- `proposals`: AI/Layer3 giải thích và đóng gói tín hiệu thành đề xuất.
- `backtest_results`: sau khi đủ dữ liệu giá tương lai, hệ thống kiểm tra đề xuất đó đúng hay sai.
- Các PnL fields trong `proposals`: bản copy kết quả backtest mới nhất để UI/API đọc nhanh.

Luồng dữ liệu:

```text
proposal PENDING
  -> lấy entryPrice gần thời điểm detectedAt
  -> lấy exitPrice gần thời điểm expiresAt hoặc horizon
  -> tính PnL
  -> ghi bản ghi chi tiết vào backtest_results
  -> cập nhật snapshot PnL vào proposals
```

#### 14.1. Vì sao cần cả `backtest_results` và PnL fields trong `proposals`?

`backtest_results` là bảng audit/history:

- Lưu kết quả backtest có cấu trúc riêng.
- Có unique index theo `proposalId`.
- Dễ dùng để thống kê win rate, total PnL, data quality, equity curve.

PnL fields trong `proposals` là denormalized snapshot:

- `entryPrice`
- `exitPrice`
- `actualPnL`
- `pnlPercentage`
- `winLossStatus`
- `backtestedAt`
- `backtestMeta`

Lý do lưu thêm trong proposal:

- API/dashboard không cần join thêm bảng backtest mỗi lần đọc proposal.
- Proposal tự mang trạng thái đánh giá mới nhất.
- UI có thể hiển thị ngay proposal này lời/lỗ/thắng/thua.

#### 14.2. Công thức PnL cho BUY/LONG

Với lệnh `buy` hoặc `stake`, hệ thống xem như LONG.

Điều chỉnh trượt giá:

`effectiveEntry = entryPrice * (1 + slippageRate)`

`effectiveExit = exitPrice * (1 - slippageRate)`

Gross PnL:

`grossPnlPercentage = (effectiveExit - effectiveEntry) / effectiveEntry`

Net PnL:

`pnlPercentage = grossPnlPercentage - feeRate * 2`

PnL USD:

`actualPnL = notionalUsd * pnlPercentage`

Cơ sở toán học:

- Đây là công thức lợi suất đơn giản: `(giá bán - giá mua) / giá mua`.
- Slippage làm giá mua xấu hơn và giá bán xấu hơn.
- Fee được tính round-trip: một lần vào lệnh và một lần thoát lệnh.

#### 14.3. Công thức PnL cho SELL/SHORT

Với lệnh `sell` hoặc `close_position`, hệ thống xem như SHORT.

Điều chỉnh trượt giá:

`effectiveEntry = entryPrice * (1 - slippageRate)`

`effectiveExit = exitPrice * (1 + slippageRate)`

Gross PnL:

`grossPnlPercentage = (effectiveEntry - effectiveExit) / effectiveEntry`

Net PnL:

`pnlPercentage = grossPnlPercentage - feeRate * 2`

PnL USD:

`actualPnL = notionalUsd * pnlPercentage`

Cơ sở toán học:

- Short có lời khi exit thấp hơn entry.
- Công thức đảo chiều so với LONG: `(giá vào short - giá đóng short) / giá vào short`.
- Slippage làm entry short thấp hơn và exit buy-back cao hơn, tức bất lợi cho kết quả.

#### 14.4. Phân loại WIN/LOSS/BREAKEVEN

Công thức:

`winLossStatus = WIN nếu pnlPercentage > 0`

`winLossStatus = LOSS nếu pnlPercentage < 0`

`winLossStatus = BREAKEVEN nếu abs(pnlPercentage) < 0.000001`

Cơ sở:

- Đây là phân loại dấu của lợi nhuận ròng.
- Ngưỡng rất nhỏ `0.000001` dùng để tránh sai số floating-point.

#### 14.5. Data quality

`dataQuality` trong `backtest_results` mô tả độ tin cậy của dữ liệu giá:

- `OK`: có giá gần thời điểm entry/exit.
- `SPARSE`: dữ liệu thưa, khoảng cách giá gần nhất xa hơn mong muốn.
- `FALLBACK_CURRENT_PRICE`: phải dùng giá hiện tại làm fallback.

Ý nghĩa:

- Một backtest lời/lỗ chỉ đáng tin nếu entry/exit price gần đúng thời điểm cần đo.
- Data quality giúp UI hoặc báo cáo biết kết quả nào nên được tin hơn.

#### 14.6. Ý nghĩa nghiệp vụ của bước này

Backtest không tạo signal mới ngay lập tức. Nó trả lời câu hỏi:

`Nếu tại thời điểm proposal được tạo mà ta làm theo đề xuất đó, sau horizon/expiry thì lời hay lỗ?`

Kết quả này dùng để:

- Đánh giá chất lượng signal.
- Tính win rate.
- Theo dõi PnL giả lập.
- Cập nhật niềm tin vào nguồn tin/tác giả/hyperparameter trong các bước tối ưu sau.
- Hiển thị hiệu quả proposal trên dashboard.
