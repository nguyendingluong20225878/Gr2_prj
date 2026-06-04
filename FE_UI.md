# FE UI Flow - Portfolio-first Recommendation

Tài liệu này mô tả flow UI tiếng Việt cho GR2 theo hướng: người dùng đi từ **đang có tài sản gì** -> **có cơ hội nào từ signal/news/tweets** -> **nên làm gì** -> **vì sao** -> **so sánh với quá khứ/giá/PnL** -> **trade hoặc theo dõi**.

## 0. Nguyên tắc thiết kế

1. UI phải đi từ portfolio của người dùng trước, không bắt đầu bằng danh sách signal rời rạc.
2. Cơ hội đầu tư được sinh từ signal. Signal được tạo bằng cách đọc tweets/news, nhận diện token được nhắc tới, chấm điểm sentiment/weight/z-score, rồi Layer3 dùng chính nội dung nguồn đó để sinh giải thích.
3. Không hiển thị bất kỳ trạng thái "xung đột" nào giữa bước định lượng và bước giải thích AI. Bước định lượng là nền tảng dữ liệu để sinh bước giải thích AI trong cùng pipeline, không phải hai lớp độc lập để đem ra so sánh đối lập.
4. Phần "mô phỏng chiến lược" hiện chưa có API riêng. UI nên đổi thành "So sánh quá khứ & kịch bản giao dịch" để tận dụng dữ liệu backtest/PnL/giá lịch sử hiện có.
5. Phải giữ phần trade, PnL, ROI, backtest, giá entry/exit, và so sánh lịch sử giá vì đây là phần trực tiếp liên quan tới tiền.

## 1. Core hiện tại hỗ trợ gì cho UI

### 1.1 Signal từ tweets/news

Core `signal-detector` hiện hỗ trợ:

- Đọc tweet và news.
- Nhận diện nhiều token trong cùng một tweet/bài báo.
- Với tweet: quét text bằng regex theo symbol/name.
- Với news: dùng `detectedTokens` đã được scraper trích xuất.
- Một bài báo nhắc tới 5 token có thể sinh nhiều evidence theo token.
- Mỗi token được gom các evidence liên quan, tính trọng số, entropy, z-score/alpha score.
- Chỉ giữ nguồn mạnh nhất trong `sources`, và có thể giữ nhiều nguồn hơn trong metadata/allSources.

Ý nghĩa cho UI:

- Màn hình `Chi tiết cơ hội` có thể hiển thị: "Bài báo/tweet này nhắc tới nhiều token, hệ thống chọn token liên quan nhất vì token đó có signal score/confidence/source weight tốt nhất."
- Màn hình `Phân tích token` có thể hiển thị danh sách nguồn news/tweet, weight, sourceKey, sentiment và thời điểm phát hiện.

### 1.2 Layer3 proposal

Core `layer3` hiện:

- Lấy signal RAW/PROCESSING.
- Enrich nội dung nguồn từ `tweets` và `news_articles`.
- Gửi prompt cho Gemini để viết rationale tiếng Việt.
- Upsert vào `proposals` theo `signalId`.
- Proposal lưu lại `tokenSymbol`, `tokenAddress`, `suggestionType`, `quantScore`, `confidence`, `sources`, `rationaleSummary`, `scoreComponents`, `expiresAt`.

Ý nghĩa cho UI:

- Proposal không phải một lớp đối lập với signal.
- Proposal là bản giải thích/diễn giải từ signal.
- UI nên gọi đây là `Giải thích AI từ signal`, không trình bày như một trạng thái xung đột.

### 1.3 Backtest, PnL, lịch sử giá

Core `research/backtest` hiện hỗ trợ:

- So sánh proposal với giá lịch sử.
- Tính entryPrice, exitPrice.
- Tính grossPnlPercentage, pnlPercentage, actualPnL.
- Phân loại WIN/LOSS/BREAKEVEN.
- Có feeRate, slippageRate, notionalUsd.
- HOLD được xử lý theo hướng missed move/rủi ro bỏ lỡ biến động.

Core `token-price-fetcher` hiện hỗ trợ:

- Lưu giá hiện tại vào `token_prices`.
- Lưu lịch sử giá vào `token_price_history`.
- Backfill giá lịch sử từ CoinGecko.
- Dùng token hint từ signals/proposals gần đây để ưu tiên backfill.

Ý nghĩa cho UI:

- Màn hình `So sánh quá khứ & kịch bản giao dịch` nên dùng backtest hiện có trước.
- Nếu muốn chart giá lịch sử chi tiết, cần API đọc `token_price_history`.
- Nếu muốn simulation realtime theo input người dùng, cần API riêng sau.

### 1.4 Model health

Backend hiện có:

```txt
GET /api/model-health
```

API này trả:

- active hyperparameter config.
- latest backtest run.
- metrics.
- train/validation window.
- latency.

Ý nghĩa cho UI:

- Có thể thêm màn hình hoặc panel `Sức khỏe mô hình`.
- Cho user biết khuyến nghị đang dùng config nào, backtest gần nhất ra sao.

## 2. API backend hiện có

```txt
POST  /api/auth/verify
POST  /api/user/create
PUT   /api/user/update
PATCH /api/user/profile

GET   /api/portfolio?wallet=...
GET   /api/signals?limit=...&type=...&cursor=...&meta=1
GET   /api/signals/:id

GET   /api/proposals
GET   /api/proposals/:id
POST  /api/proposals/:id/decision

POST  /api/trade/execute

GET   /api/model-health
```

## 3. API còn thiếu nếu muốn UI đầy đủ

Các API này chưa có trong backend web hiện tại, nhưng nên thêm nếu muốn sản phẩm hoàn chỉnh:

```txt
GET   /api/tokens/:tokenSymbol/price-history
GET   /api/tokens/:tokenSymbol/rolling-metrics

GET   /api/alerts?wallet=...
POST  /api/alerts
PATCH /api/alerts/:id
DELETE /api/alerts/:id

GET   /api/watchlist?wallet=...
POST  /api/watchlist
DELETE /api/watchlist/:id

GET   /api/positions/:id
POST  /api/positions/:id/close

POST  /api/trade/preview
POST  /api/scenario/compare
```

Khuyến nghị thực tế:

- Không nên làm `POST /api/simulation` phức tạp ngay.
- Trước mắt đổi màn hình mô phỏng thành `So sánh quá khứ & kịch bản giao dịch`.
- Dùng `GET /api/proposals/:id` để lấy backtest/PnL/entry/exit.
- Sau đó bổ sung `POST /api/trade/preview` để tính size, leverage, max loss, expected PnL trước khi execute.

## 4. Flow tổng thể

```txt
Đăng nhập ví
  -> Tổng quan  
  -> Danh mục
  -> Chẩn đoán danh mục
  -> Khuyến nghị hành động
  -> Chi tiết tài sản / Chi tiết cơ hội
  -> Phân tích signal & nguồn tin
  -> So sánh quá khứ & kịch bản giao dịch
  -> Chi tiết đề xuất
  -> Theo dõi / Chờ giá / Vào lệnh
  -> Vị thế
  -> Theo dõi vị thế
  -> Tổng quan
```
//nHẬN XÉT VỀ MÀNH HÌNH : Ở THANH BAR TRÊN CÙNG THÌ Ở ĐOẠN DLuong (VÀ ĐỊA CHỈ VÍ) TÔI MUỐN CLICK VÀO ĐÓ SẼ HIỆN NÚT CÀI ĐẶT ĐỂ THAY ĐỔI FROM ONBOAREDING NẾU MUỐN
## 5. Màn hình 1 - Đăng nhập ví || OK

Tên màn hình: `Đăng nhập ví`

Mục đích:

- Xác định user theo wallet.
- Kiểm tra user đã onboarding chưa.

Thành phần hiển thị:

- Nút `Kết nối ví`.
- Wallet address sau khi kết nối.
- Trạng thái: `Đã có hồ sơ` hoặc `Cần tạo hồ sơ`.
- Form onboarding nếu user mới:
  - Tên.
  - Email.
  - Tuổi.
  - Mức chịu rủi ro.
  - Phong cách giao dịch.
  - Tổng tài sản.
  - Số tiền đầu tư crypto.

API gọi:

```txt
POST /api/auth/verify
```

Body:

```json
{
  "walletAddress": "..."
}
```

Nếu user mới:

```txt
POST /api/user/create
```

Nút chức năng:

- `Kết nối ví`: mở wallet connector, sau đó gọi `POST /api/auth/verify`.
- `Tạo hồ sơ`: gọi `POST /api/user/create`.
- `Tiếp tục`: đi tới `Tổng quan`.

## 6. Màn hình 2 - Tổng quan
// PHẦN TỔNG giá trị danh mục hiện tại đang là 0 , hãy check xem là lỗi code hay DO là 0 thật
// ACTIVE POSITIONS LÀ GÌ
//PROPOSAL/WATCHLIST NÀY LÂY Ở ĐÂU
//Ở PHẦN Hành động nên làm hôm nay: VÌ SAO CHỈ CÓ 3 TÍN HIỆU, VÌ SAO QUANT VÀ ROI LẠI LÀ N/A, THỜI GIAN CÒN LẠI VÀ RỦI RO LẠI ĐỀU GIỐNG NHAU
// Ở PHẦN CƠ HỘI NỔI BẬT ĐANG LAF Chưa có Signal nổi bật?

Tên màn hình: `Tổng quan`

Mục đích:

- Cho user biết nhanh hôm nay cần quan tâm gì.
- Ưu tiên portfolio trước, signal sau.

Thành phần hiển thị:

- `Tổng giá trị danh mục`: lấy từ `stats.totalValue`.
- `Tài sản đang nắm giữ`: top holdings.
- `Vị thế đang mở`: số lượng active positions.
- `Đề xuất đang chờ`: số lượng proposal/watchlist.
- `Hành động nên làm hôm nay`: lấy từ proposals mới nhất.
- `Cơ hội nổi bật từ news/tweets`: lấy từ signals/proposals có confidence cao.
- `Cảnh báo dữ liệu`: holding thiếu giá, signal/proposal sắp hết hạn.

API gọi:

```txt
GET /api/portfolio?wallet={walletAddress}
GET /api/proposals
GET /api/signals?limit=20&type=ALL&meta=1
GET /api/model-health
```

Nút chức năng:

- `Xem danh mục`: đi tới `Danh mục`, dùng `GET /api/portfolio`.
- `Xem chẩn đoán`: đi tới `Chẩn đoán danh mục`, dùng portfolio + signals.
- `Xem khuyến nghị`: đi tới `Khuyến nghị hành động`, gọi `GET /api/proposals`.
- `Xem cơ hội mới`: đi tới `Cơ hội từ news/tweets`, gọi `GET /api/signals`.
- `Xem vị thế`: đi tới `Vị thế`, dùng `portfolio.investments`.
- `Xem sức khỏe mô hình`: mở panel `Sức khỏe mô hình`, gọi `GET /api/model-health`.

## 7. Màn hình 3 - Danh mục

Tên màn hình: `Danh mục`

Mục đích:

- Hiển thị user đang có tài sản gì.
- Đây là đầu vào để cá nhân hóa recommendation.

Thành phần hiển thị:

- Tổng giá trị danh mục.
- Danh sách holdings:
  - Token.
  - Số lượng.
  - Giá hiện tại.
  - Giá trị USD.
  - Chất lượng dữ liệu giá: `OK` hoặc `MISSING_PRICE`.
- Phân bổ theo tài sản.
- Vị thế đang mở.
- Đề xuất đang theo dõi.
- Lần sync ví gần nhất nếu FE lưu được.

API gọi:

```txt
GET /api/portfolio?wallet={walletAddress}
```

Nút chức năng:

- `Đồng bộ ví`: cập nhật balances.
  - API:
    ```txt
    PATCH /api/user/profile
    ```
- `Xem chi tiết tài sản`: đi tới `Chi tiết tài sản đang có`.
  - API phụ: `GET /api/signals?limit=50&type=ALL&meta=1`.
- `Xem đề xuất cho tài sản này`: đi tới `Khuyến nghị hành động` đã filter token.
  - API: `GET /api/proposals`.
- `Xem vị thế liên quan`: đi tới `Vị thế`.
  - API: `GET /api/portfolio`.

## 8. Màn hình 4 - Chẩn đoán danh mục

Tên màn hình: `Chẩn đoán danh mục`

Mục đích:

- Biến portfolio thành các câu hỏi hành động: tài sản nào rủi ro, tài sản nào có cơ hội, dữ liệu nào chưa đủ.

Thành phần hiển thị:

- `Tài sản có cơ hội nhất`: token user đang giữ có signal/proposal tốt.
- `Tài sản rủi ro nhất`: token có riskLevel cao, winLossStatus xấu, signal tiêu cực hoặc dữ liệu giá thiếu.
- `Tài sản thiếu tín hiệu`: token có trong holdings nhưng không có signal gần đây.
- `Signal sắp hết hạn`: dựa vào `expiresAt`.
- `Độ tin cậy`: confidence + confidenceBreakdown.
- `Chất lượng dữ liệu`: COLD_START/NORMALIZED_ALPHA, sampleSize, dataQuality.

API gọi:

```txt
GET /api/portfolio?wallet={walletAddress}
GET /api/signals?limit=100&type=ALL&meta=1
GET /api/proposals
```

Nút chức năng:

- `Xem khuyến nghị`: đi tới `Khuyến nghị hành động`.
- `Xem lý do`: đi tới `Giải thích signal`.
- `Xem giá quá khứ`: đi tới `So sánh quá khứ & giá`.
  - Hiện dùng `GET /api/proposals/:id` nếu proposal đã backtest.
  - Nếu muốn chart đầy đủ cần thêm `GET /api/tokens/:tokenSymbol/price-history`.
- `Kiểm tra dữ liệu`: mở `Kiểm tra dữ liệu và thời gian`.

## 9. Màn hình 5 - Khuyến nghị hành động

Tên màn hình: `Khuyến nghị hành động`

Mục đích:

- Đưa ra hành động cụ thể cho user: giữ, mua, chờ, giảm, đóng vị thế.

Thành phần hiển thị:

- Nhóm `Tài sản bạn đang có`.
- Nhóm `Cơ hội mới ngoài danh mục`.
- Nhóm `Đề xuất sắp hết hạn`.
- Mỗi card hiển thị:
  - Token.
  - Hành động: `Mua`, `Bán`, `Giữ`, `Đóng vị thế`, `Theo dõi`.
  - Confidence.
  - Quant score.
  - ROI/PnL từ backtest nếu có.
  - Risk level.
  - Thời hạn hiệu lực.
  - Nguồn tin mạnh nhất.

API gọi:

```txt
GET /api/proposals
GET /api/portfolio?wallet={walletAddress}
GET /api/signals?limit=100&type=ALL&meta=1
```

Nút chức năng:

- `Xem tài sản đang có`: đi tới `Chi tiết tài sản đang có`.
- `Xem cơ hội`: đi tới `Chi tiết cơ hội`.
- `Xem lý do`: đi tới `Giải thích signal`.
  - API: `GET /api/proposals/:id`.
- `So sánh quá khứ`: đi tới `So sánh quá khứ & kịch bản giao dịch`.
  - API: `GET /api/proposals/:id`.
- `Vào chi tiết đề xuất`: đi tới `Chi tiết đề xuất`.
  - API: `GET /api/proposals/:id`.

## 10. Màn hình 6 - Cơ hội từ news/tweets

Tên màn hình: `Cơ hội từ news/tweets`

Mục đích:

- Hiển thị cơ hội được phát hiện từ nội dung tweets/news.
- Giải thích rõ vì sao một token được chọn khi một bài viết nhắc tới nhiều token.

Thành phần hiển thị:

- Danh sách bài tweet/news có signal.
- Với mỗi source:
  - Loại nguồn: `X/Twitter` hoặc `News Article`.
  - Source URL.
  - Source key.
  - Source weight.
  - Các token được nhắc tới.
  - Token được hệ thống chọn là cơ hội chính.
  - Lý do chọn:
    - score cao hơn.
    - confidence cao hơn.
    - source weight mạnh hơn.
    - signal còn hiệu lực.
    - backtest tốt hơn nếu có.
- Badge:
  - `Tin tức mới`.
  - `Nguồn có trọng số cao`.
  - `Cold-start`.
  - `Đã backtest`.

API gọi:

```txt
GET /api/signals?limit=100&type=ALL&meta=1
GET /api/proposals
```

Ghi chú:

- Backend hiện chưa expose trực tiếp tất cả token được nhắc tới trong cùng bài viết.
- Signal hiện expose `sources`, `quantScore`, `confidence`, `metadata.scoreComponents`.
- Nếu muốn UI hiển thị "bài báo nhắc 5 token và token nào thắng", nên bổ sung metadata/API cho `matchedTokens` hoặc `sourceTokenCandidates`.

API đề xuất thêm:

```txt
GET /api/opportunities?source=signals
```

Response nên có:

```json
{
  "sourceUrl": "...",
  "sourceType": "news",
  "mentionedTokens": ["SOL", "JUP", "LINK"],
  "selectedToken": "SOL",
  "selectionReason": {
    "quantScore": 2.4,
    "confidence": 0.78,
    "sourceWeight": 3.1,
    "backtest": "WIN"
  }
}
```

Nút chức năng:

- `Xem nguồn`: mở URL tweet/news.
- `Xem token được chọn`: đi tới `Chi tiết cơ hội`.
- `Xem signal`: đi tới `Phân tích signal`.
- `So sánh với token khác`: cần API mới `/api/opportunities`.

## 11. Màn hình 7 - Chi tiết tài sản đang có

Tên màn hình: `Chi tiết tài sản đang có`

Mục đích:

- Trả lời user nên làm gì với token họ đang sở hữu.

Thành phần hiển thị:

- Token.
- Số lượng user đang giữ.
- Giá hiện tại.
- Giá trị USD.
- Tỷ trọng trong danh mục.
- Proposal liên quan.
- Hành động đề xuất.
- Signal score.
- Confidence.
- ROI/PnL quá khứ.
- Signal validity.
- Source evidence.

API gọi:

```txt
GET /api/portfolio?wallet={walletAddress}
GET /api/proposals
GET /api/signals?limit=100&type=ALL&meta=1
GET /api/proposals/:id
```

Nút chức năng:

- `Xem signal`: đi tới `Phân tích signal`.
  - API: `GET /api/signals/:id`.
- `Xem giá quá khứ`: đi tới `So sánh quá khứ & giá`.
  - API hiện tại: `GET /api/proposals/:id`.
  - API cần thêm cho chart: `GET /api/tokens/:tokenSymbol/price-history`.
- `Mở đề xuất`: đi tới `Chi tiết đề xuất`.
  - API: `GET /api/proposals/:id`.
- `Vào lệnh`: đi tới `Xác nhận giao dịch`.
  - API execute cuối: `POST /api/trade/execute`.

## 12. Màn hình 8 - Chi tiết cơ hội

Tên màn hình: `Chi tiết cơ hội`

Mục đích:

- Giải thích cơ hội ngoài portfolio hoặc cơ hội nổi bật từ tweets/news.

Thành phần hiển thị:

- Token cơ hội.
- Source chính tạo ra cơ hội.
- Nội dung tweet/news tóm tắt.
- Nếu source nhắc nhiều token:
  - Hiển thị các token được nhắc tới nếu backend expose.
  - Hiển thị token được chọn.
  - Lý do chọn token đó: score/confidence/source weight/backtest.
- Hành động đề xuất.
- Quant score.
- Confidence.
- Rationale từ Layer3.
- Backtest/PnL nếu có.
- Entry price/exit price nếu có.
- Risk level.
- Thời hạn hiệu lực.

API gọi:

```txt
GET /api/proposals/:id
GET /api/signals/:id
```

Nút chức năng:

- `Xem nguồn tin`: mở URL trong `sources`.
- `Xem phân tích signal`: gọi `GET /api/signals/:id`.
- `So sánh quá khứ`: gọi `GET /api/proposals/:id`, sau này thêm price-history API.
- `Theo dõi cơ hội`: gọi `POST /api/proposals/:id/decision` với `decision = WAIT`.
- `Vào chi tiết đề xuất`: gọi `GET /api/proposals/:id`.

## 13. Màn hình 9 - Phân tích signal

Tên màn hình: `Phân tích signal`

Mục đích:

- Hiển thị dữ liệu định lượng đứng sau recommendation.

Thành phần hiển thị:

- Token.
- Suggestion type.
- Sentiment type.
- Quant score.
- Direction score nếu backend expose.
- Confidence.
- Confidence breakdown.
- Score components:
  - timeZ.
  - pureAlphaZ.
  - crossZ.
  - finalScore.
- Entropy/uncertainty.
- Realized volatility.
- Signal mode:
  - `COLD_START`.
  - `NORMALIZED_ALPHA`.
- Sources:
  - label.
  - url.
  - sourceKey.
  - weight.
- Lifecycle:
  - QUANT_READY.
  - EXPLANATION_PENDING.
  - EXPLAINED.
  - BACKTESTED.
- Expires at.

API gọi:

```txt
GET /api/signals/:id
GET /api/signals?limit=100&type=ALL&meta=1
```

Nút chức năng:

- `Xem nguồn`: mở source URL.
- `Xem giải thích AI`: đi tới `Giải thích AI từ signal`.
  - API: `GET /api/proposals/:id`.
- `Xem backtest`: đi tới `So sánh quá khứ & giá`.
  - API: `GET /api/proposals/:id`.
- `Mở đề xuất`: đi tới `Chi tiết đề xuất`.

## 14. Màn hình 10 - Giải thích AI từ signal

Tên màn hình: `Giải thích AI từ signal`

Mục đích:

- Diễn giải proposal bằng tiếng Việt dựa trên signal và nội dung tweet/news.

Thành phần hiển thị:

- Kết luận ngắn: nên mua/bán/giữ/chờ.
- Rationale summary.
- Tin tức/tweet nào hỗ trợ kết luận.
- Quant score.
- Confidence.
- Vì sao signal đủ/không đủ mạnh.
- Cảnh báo cold-start nếu confidence thấp hoặc signalMode là COLD_START.
- Điều kiện làm khuyến nghị sai.

Không hiển thị:

- Không hiển thị trạng thái xung đột giữa bước định lượng và bước giải thích AI.
- Nếu API trả field `layerConflict`, FE bỏ qua field đó.

API gọi:

```txt
GET /api/proposals/:id
GET /api/signals/:id
```

Nút chức năng:

- `Xem dữ liệu gốc`: đi tới `Phân tích signal`.
- `Xem giá quá khứ`: đi tới `So sánh quá khứ & giá`.
- `Mở đề xuất`: đi tới `Chi tiết đề xuất`.

## 15. Màn hình 11 - So sánh quá khứ & kịch bản giao dịch

Tên màn hình: `So sánh quá khứ & kịch bản giao dịch`

Mục đích:

- Thay thế `Mô phỏng chiến lược` vì backend chưa có API simulation realtime.
- Tập trung vào thứ backend đã có: backtest, PnL, ROI, giá entry/exit, win/loss, slippage/fee.

Thành phần hiển thị:

- Kết quả backtest:
  - WIN/LOSS/BREAKEVEN/SKIPPED.
  - Entry price.
  - Exit price.
  - Gross PnL %.
  - Net PnL %.
  - Actual PnL.
  - Fee rate.
  - Slippage rate.
  - Notional USD.
  - Data quality.
- So sánh giá:
  - Giá tại thời điểm phát hiện signal.
  - Giá tại thời điểm hết hạn signal.
  - Chênh lệch giá.
  - Nếu có price-history API: chart giá trước/sau signal.
- Kịch bản giao dịch FE-only:
  - Nếu vào lệnh với size X USD.
  - Nếu leverage 1x/2x/5x.
  - Max loss theo stop-loss giả định.
  - PnL kỳ vọng dựa trên `pnlPercentage` đã backtest.

API hiện có:

```txt
GET /api/proposals/:id
```

API nên thêm:

```txt
GET  /api/tokens/:tokenSymbol/price-history?from=...&to=...
POST /api/trade/preview
```

Lý do cần `POST /api/trade/preview`:

- FE không nên tự quyết định toàn bộ risk sizing.
- Backend nên tính:
  - recommendedSizeUsd.
  - maxLossUsd.
  - leverage hợp lệ.
  - liquidation risk nếu có.
  - stopLossPct.
  - notionalUsd.

Nút chức năng:

- `Dùng kịch bản này`: lưu amount/leverage vào state, đi tới `Xác nhận giao dịch`.
- `Xem chi tiết đề xuất`: gọi `GET /api/proposals/:id`.
- `Xem giá lịch sử`: gọi API mới `GET /api/tokens/:tokenSymbol/price-history`.
- `Quay lại khuyến nghị`: gọi `GET /api/proposals`.

## 16. Màn hình 12 - Chi tiết đề xuất

Tên màn hình: `Chi tiết đề xuất`

Mục đích:

- Màn hình quyết định cuối trước khi theo dõi, chờ giá, hoặc trade.

Thành phần hiển thị:

- Token.
- Hành động đề xuất.
- Summary/rationale.
- Reason list.
- Sources.
- Confidence.
- Quant score.
- Score components.
- Financial impact:
  - currentValue/currentPrice.
  - projectedValue/targetPrice.
  - projectedPnL.
  - ROI.
  - riskLevel.
- Backtest:
  - entryPrice.
  - exitPrice.
  - actualPnL.
  - pnlPercentage.
  - winLossStatus.
  - backtestedAt.
  - backtestMeta.
- Signal context:
  - signalMode.
  - uncertaintyEntropy.
  - realizedVolatility.
  - expiresAt.
- Execution status:
  - PENDING.
  - EXECUTED.
  - IGNORED.

API gọi:

```txt
GET /api/proposals/:id
```

Nút chức năng:

- `Theo dõi`: ghi nhận user chọn WAIT.
  - API:
    ```txt
    POST /api/proposals/:id/decision
    ```
  - Body:
    ```json
    {
      "decision": "WAIT",
      "walletAddress": "...",
      "reason": "Theo dõi đề xuất, chưa vào lệnh"
    }
    ```
- `Chờ vùng giá`: hiện dùng `decision = WAIT`.
  - Nên bổ sung `POST /api/alerts` nếu muốn alert thật.
- `Từ chối`: ghi nhận REJECT.
  - API:
    ```txt
    POST /api/proposals/:id/decision
    ```
- `Vào lệnh`: đi tới `Xác nhận giao dịch`.
  - API execute cuối: `POST /api/trade/execute`.

## 17. Màn hình 13 - Xác nhận giao dịch

Tên màn hình: `Xác nhận giao dịch`

Mục đích:

- Cho user xác nhận size, leverage, direction trước khi execute.

Thành phần hiển thị:

- Token.
- Direction: LONG/SHORT.
- Entry price.
- Amount USD.
- Leverage.
- Notional USD.
- Risk plan:
  - recommendedSizeUsd.
  - maxLossUsd.
  - riskPerTradePct.
  - stopLossPct.
- Proposal summary.
- Cảnh báo nếu proposal đã hết hạn.
- Cảnh báo nếu executionStatus không còn PENDING.

API gọi trước khi execute:

```txt
GET /api/proposals/:id
```

API nên thêm trước execute:

```txt
POST /api/trade/preview
```

API execute hiện có:

```txt
POST /api/trade/execute
```

Body:

```json
{
  "walletAddress": "...",
  "proposalId": "...",
  "tokenSymbol": "SOL",
  "tokenAddress": "...",
  "amount": 100,
  "entryPrice": 150,
  "direction": "LONG",
  "leverage": 1,
  "riskPlan": {
    "maxLossUsd": 10,
    "recommendedSizeUsd": 100,
    "riskPerTradePct": 1,
    "stopLossPct": 5
  }
}
```

Nút chức năng:

- `Xác nhận vào lệnh`: gọi `POST /api/trade/execute`.
- `Quay lại đề xuất`: gọi `GET /api/proposals/:id`.
- `Chỉ theo dõi`: gọi `POST /api/proposals/:id/decision` với `WAIT`.

## 18. Màn hình 14 - Vị thế

Tên màn hình: `Vị thế`

Mục đích:

- Hiển thị các position đã được execute.

Thành phần hiển thị:

- Open positions.
- Token.
- Direction.
- Size.
- Leverage.
- Entry price.
- Executed price.
- Requested price.
- Slippage.
- Tx hash.
- PnL.
- ROI.
- Proposal ID.
- Execution ID.

API gọi:

```txt
GET /api/portfolio?wallet={walletAddress}
```

Dữ liệu dùng:

```txt
portfolio.investments[]
```

Nút chức năng:

- `Theo dõi vị thế`: đi tới `Theo dõi vị thế`.
  - API hiện tại: `GET /api/portfolio`.
  - Nên thêm: `GET /api/positions/:id`.
- `Xem đề xuất gốc`: gọi `GET /api/proposals/:id`.
- `Đóng vị thế`: cần thêm `POST /api/positions/:id/close`.

## 19. Màn hình 15 - Theo dõi vị thế

Tên màn hình: `Theo dõi vị thế`

Mục đích:

- Theo dõi sau khi trade, so sánh vị thế hiện tại với proposal/signal ban đầu.

Thành phần hiển thị:

- Entry price.
- Current/mark price nếu có.
- PnL.
- ROI.
- Leverage.
- Direction.
- Signal ban đầu.
- Signal hiện tại cùng token.
- Proposal gốc.
- Cảnh báo:
  - proposal đã hết hạn.
  - signal mới yếu hơn.
  - giá đi ngược hướng.
  - risk vượt ngưỡng.

API gọi:

```txt
GET /api/portfolio?wallet={walletAddress}
GET /api/proposals/:id
GET /api/signals?limit=100&type=ALL&meta=1
```

API nên thêm:

```txt
GET /api/positions/:id
POST /api/positions/:id/close
GET /api/tokens/:tokenSymbol/price-history
```

Nút chức năng:

- `Xem đề xuất gốc`: gọi `GET /api/proposals/:id`.
- `Xem signal mới`: gọi `GET /api/signals?type=ALL`.
- `Đóng vị thế`: cần `POST /api/positions/:id/close`.
- `Về tổng quan`: gọi `GET /api/portfolio`.

## 20. Màn hình 16 - Danh sách theo dõi

Tên màn hình: `Danh sách theo dõi`

Mục đích:

- Hiển thị proposal/token user đang muốn theo dõi nhưng chưa trade.

Thành phần hiển thị:

- Token.
- Proposal title.
- ROI kỳ vọng.
- Confidence.
- Created at.
- Expires at.
- Reason user chọn WAIT nếu có.

API hiện có:

```txt
GET /api/portfolio?wallet={walletAddress}
```

Backend hiện lấy `watchlist` từ pending proposals, chưa phải watchlist cá nhân đầy đủ.

API nên thêm:

```txt
GET /api/watchlist?wallet=...
POST /api/watchlist
DELETE /api/watchlist/:id
```

Nút chức năng:

- `Mở đề xuất`: gọi `GET /api/proposals/:id`.
- `Bỏ theo dõi`: cần `DELETE /api/watchlist/:id`.
- `Đặt cảnh báo`: cần `POST /api/alerts`.

## 21. Màn hình 17 - Cảnh báo

Tên màn hình: `Cảnh báo`

Mục đích:

- Theo dõi entry zone, signal sắp hết hạn, risk alert.

Thành phần hiển thị:

- Entry zone alerts.
- Signal expiring soon.
- Risk alerts.
- Proposal expiring soon.
- Alert status.
- Token/proposal liên quan.

API hiện có thể dùng tạm:

```txt
GET /api/signals?limit=100&type=ALL&meta=1
GET /api/proposals
```

Logic tạm:

- `signal.expiresAt` gần hiện tại -> signal sắp hết hạn.
- `proposal.expiresAt` gần hiện tại -> proposal sắp hết hạn.
- `riskLevel = HIGH` -> risk alert.
- `dataQuality = MISSING_PRICE` -> cảnh báo dữ liệu giá.

API nên thêm:

```txt
GET /api/alerts?wallet=...
POST /api/alerts
PATCH /api/alerts/:id
DELETE /api/alerts/:id
```

Nút chức năng:

- `Mở đề xuất`: gọi `GET /api/proposals/:id`.
- `Mở vị thế`: gọi `GET /api/portfolio`.
- `Tắt cảnh báo`: cần `PATCH /api/alerts/:id`.
- `Xóa cảnh báo`: cần `DELETE /api/alerts/:id`.

## 22. Màn hình 18 - Kiểm tra dữ liệu và thời gian

Tên màn hình: `Kiểm tra dữ liệu và thời gian`

Mục đích:

- Đảm bảo recommendation không dựa trên dữ liệu cũ.

Thành phần hiển thị:

- Wallet sync time.
- Price updated time.
- Signal detectedAt.
- Signal expiresAt.
- Proposal createdAt.
- Proposal expiresAt.
- BacktestedAt.
- Data quality.
- Signal mode.
- Model config updatedAt.

API gọi:

```txt
GET /api/portfolio?wallet={walletAddress}
GET /api/signals/:id
GET /api/proposals/:id
GET /api/model-health
```

Nút chức năng:

- `Dữ liệu ổn`: quay lại `Khuyến nghị hành động`.
- `Đồng bộ lại ví`: gọi `PATCH /api/user/profile`.
- `Xem sức khỏe mô hình`: gọi `GET /api/model-health`.

## 23. Màn hình 19 - Sức khỏe mô hình

Tên màn hình: `Sức khỏe mô hình`

Mục đích:

- Hiển thị độ tin cậy vận hành của model/backtest/config.

Thành phần hiển thị:

- Active config:
  - status.
  - params.
  - metrics.
  - promotedAt.
  - updatedAt.
- Latest backtest run:
  - status.
  - optimizer.
  - trainWindow.
  - validationWindow.
  - metrics.
  - startedAt.
  - endedAt.
- Latency.

API gọi:

```txt
GET /api/model-health
```

Nút chức năng:

- `Làm mới`: gọi lại `GET /api/model-health`.
- `Về tổng quan`: quay lại `Tổng quan`.

## 24. Mapping nhanh màn hình -> API

```txt
Đăng nhập ví
  POST /api/auth/verify
  POST /api/user/create

Tổng quan
  GET /api/portfolio
  GET /api/proposals
  GET /api/signals
  GET /api/model-health

Danh mục
  GET /api/portfolio
  PATCH /api/user/profile

Chẩn đoán danh mục
  GET /api/portfolio
  GET /api/signals
  GET /api/proposals

Khuyến nghị hành động
  GET /api/proposals
  GET /api/portfolio
  GET /api/signals

Cơ hội từ news/tweets
  GET /api/signals
  GET /api/proposals
  Nên thêm GET /api/opportunities

Chi tiết tài sản đang có
  GET /api/portfolio
  GET /api/proposals/:id
  GET /api/signals/:id

Chi tiết cơ hội
  GET /api/proposals/:id
  GET /api/signals/:id

Phân tích signal
  GET /api/signals/:id
  GET /api/signals

Giải thích AI từ signal
  GET /api/proposals/:id
  GET /api/signals/:id

So sánh quá khứ & kịch bản giao dịch
  GET /api/proposals/:id
  Nên thêm GET /api/tokens/:tokenSymbol/price-history
  Nên thêm POST /api/trade/preview

Chi tiết đề xuất
  GET /api/proposals/:id
  POST /api/proposals/:id/decision

Xác nhận giao dịch
  GET /api/proposals/:id
  POST /api/trade/execute
  Nên thêm POST /api/trade/preview

Vị thế
  GET /api/portfolio

Theo dõi vị thế
  GET /api/portfolio
  GET /api/proposals/:id
  GET /api/signals
  Nên thêm GET /api/positions/:id
  Nên thêm POST /api/positions/:id/close

Danh sách theo dõi
  GET /api/portfolio
  Nên thêm /api/watchlist

Cảnh báo
  GET /api/signals
  GET /api/proposals
  Nên thêm /api/alerts

Kiểm tra dữ liệu và thời gian
  GET /api/portfolio
  GET /api/signals/:id
  GET /api/proposals/:id
  GET /api/model-health

Sức khỏe mô hình
  GET /api/model-health
```

## 25. Các thay đổi quan trọng so với bản cũ

1. `Chi tiết cơ hội` đã chuyển sang logic dựa trên tweets/news trong signal.
2. Đã bỏ hoàn toàn khái niệm xung đột giữa bước định lượng và bước giải thích AI khỏi UI.
3. `Mô phỏng chiến lược` đổi thành `So sánh quá khứ & kịch bản giao dịch`.
4. Giữ rõ phần trade:
   - execute trade.
   - position.
   - PnL.
   - ROI.
   - leverage.
   - risk plan.
5. Giữ rõ phần so sánh quá khứ:
   - backtest.
   - entry/exit price.
   - price history.
   - win/loss/breakeven.
6. Thêm màn hình `Sức khỏe mô hình` vì backend đã có `/api/model-health`.
7. Ghi rõ API nào đã có và API nào nên bổ sung.
