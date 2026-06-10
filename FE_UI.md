# FE UI - NDL Personal Crypto Decision Assistant

Tài liệu này ghi lại thay đổi UI mới và hướng dẫn test lại frontend sau Sprint 1, Sprint 2 và các fix review Sprint 2.

Mục tiêu sản phẩm hiện tại:

- NDL là personal crypto decision assistant, không phải dashboard nội bộ.
- Portfolio-first, signal-second.
- Decision before explanation.
- Ngôn ngữ user/trader trước, thuật ngữ kỹ thuật chỉ nằm trong Advanced/Debug.
- Expired hoặc thiếu dữ liệu không được trình bày như cơ hội hành động mới.

## 1. Thay Đổi Chính

### Navigation

Main nav và mobile bottom nav chỉ còn 5 mục:

| Label | Route | Vai trò |
| --- | --- | --- |
| Tổng quan | `/overview` | Today Decision Inbox |
| Danh mục | `/portfolio` | Holdings, rủi ro, dữ liệu thiếu, khuyến nghị liên quan |
| Khuyến nghị | `/recommendations` | Recommendation Center |
| Theo dõi | `/watchlist` | Các khuyến nghị user đang quan sát |
| Vị thế | `/positions` | Vị thế/giao dịch mô phỏng |

Các route không còn nằm trong nav chính:

- `/alerts`
- `/diagnostics`
- `/model-health`
- `/opportunities`

`/opportunities` redirect sang:

```txt
/recommendations?tab=outside-portfolio
```

### Copy Cleanup

User-facing UI ưu tiên các từ sau:

| Trước | Sau |
| --- | --- |
| Proposal | Khuyến nghị / Luận điểm |
| Quant | Điểm tín hiệu |
| Cross-impact | Ảnh hưởng gián tiếp |
| Diagnostics | Kiểm tra rủi ro |
| Model Health | Độ tin cậy hệ thống |
| Backtest | Kết quả kiểm chứng |

Không hiển thị API path như `/api/proposals` hoặc `/api/portfolio/cross-impacts` trong UI user-facing.

Raw JSON/config/status kỹ thuật chỉ được phép ở khu vực có nhãn `Advanced`, `Debug`, hoặc `Trust Center`.

### Overview

`/overview` đã chuyển thành Today Decision Inbox, trả lời:

```txt
Hôm nay danh mục crypto của tôi cần xử lý gì?
```

Các phần chính:

- Header có TrustBadge nhỏ.
- Top metrics:
  - Tổng giá trị danh mục
  - Việc cần xử lý hôm nay
  - Rủi ro cần chú ý
  - Tín hiệu sắp hết hạn
- Risk Banner trước action queue nếu thiếu giá, dữ liệu cũ, hoặc có tín hiệu hết hiệu lực.
- Section `Cần xử lý ngay`.
- Today Action Queue tối đa 5 items.
- Nếu nhiều hơn 5 items, CTA là `Xem tất cả khuyến nghị`.
- Empty state: `Không có việc cần xử lý ngay`.

### Recommendation Center

`/recommendations` là trung tâm khuyến nghị, gom cả khuyến nghị liên quan danh mục và outside opportunities.

Tabs bắt buộc:

| Tab | Search param | Ý nghĩa |
| --- | --- | --- |
| Cần xử lý ngay | `?tab=urgent` | Khuyến nghị còn hiệu lực, cần xem trước |
| Liên quan danh mục | `?tab=portfolio` | Direct/indirect impact tới holdings |
| Ngoài danh mục | `?tab=outside-portfolio` | Không liên quan trực tiếp danh mục |
| Đã kiểm chứng | `?tab=verified` | Đã có kết quả kiểm chứng |
| Hết hiệu lực | `?tab=expired` | Chỉ để tham khảo, không phải cơ hội mới |

Không có tab `Đang theo dõi`; trạng thái theo dõi chỉ là badge `Đã theo dõi`.

Recommendation card phải có badge theo thứ tự:

1. Action
2. Portfolio impact
3. Risk
4. Expiry/status
5. Watched

CTA chính của card là:

```txt
Xem chi tiết
```

CTA phụ nếu có:

```txt
Theo dõi
```

Expired card phải muted, không có trade/execute CTA.

#### Recommendation Tabs: API Và Lý Do Sử Dụng

`/recommendations` không gọi API riêng cho từng tab. Page dùng chung data từ `useNdlData()` rồi derive/filter ở frontend để tab switching nhanh, không reload dữ liệu và không phụ thuộc backend đã phân nhóm sẵn.

Data sources chính:

| Data | API | Dùng để làm gì |
| --- | --- | --- |
| Portfolio | `GET /api/portfolio` | Lấy holdings để biết token nào user đang nắm giữ, từ đó derive direct impact |
| Recommendations | `GET /api/proposals` | Nguồn danh sách khuyến nghị/action chính |
| Indirect impacts | `GET /api/portfolio/cross-impacts` | Xác định khuyến nghị nào ảnh hưởng gián tiếp tới danh mục |
| Watchlist | `GET /api/watchlist` | Đánh dấu `Đã theo dõi`, tránh user add trùng |
| Add watch | `POST /api/watchlist` | Khi user bấm `Theo dõi` trên card |

Tab behavior:

| Tab | Data/filter chính | Vì sao dùng |
| --- | --- | --- |
| `Cần xử lý ngay` | Khuyến nghị `ACTIVE`, `EXPIRING_SOON`, hoặc `MISSING_DATA`, sort theo độ ưu tiên và còn liên quan quyết định hôm nay | Đây là inbox hành động. User không cần đọc tất cả, chỉ cần biết việc nào đáng xử lý trước |
| `Liên quan danh mục` | `portfolioImpact` là `DIRECT` hoặc `INDIRECT`, bỏ expired/verified/executed khỏi luồng hành động chính | Portfolio-first: ưu tiên tài sản user đang giữ hoặc tài sản có ảnh hưởng tới holdings |
| `Ngoài danh mục` | `portfolioImpact` là `OUTSIDE`, bỏ expired/verified/executed | Gom outside opportunities vào cùng Recommendation Center nhưng không để chúng lấn át danh mục hiện tại |
| `Đã kiểm chứng` | `status` là `VERIFIED` hoặc có kết quả kiểm chứng | Dùng để học lại quyết định cũ, không phải inbox hành động mới |
| `Hết hiệu lực` | `status` là `EXPIRED` | Giữ minh bạch lịch sử, nhưng card muted và không có execute/trade CTA |

Tab mapping:

```txt
urgent            -> /recommendations?tab=urgent
portfolio         -> /recommendations?tab=portfolio
outside-portfolio -> /recommendations?tab=outside-portfolio
verified          -> /recommendations?tab=verified
expired           -> /recommendations?tab=expired
```

Lý do không dùng API query riêng cho từng tab trong Sprint 2:

- Các tab đều cần cùng một tập dữ liệu nền: holdings, recommendations, watchlist, indirect impacts.
- `portfolioImpact`, `status`, `isWatched` là frontend-derived để không chờ backend đổi schema.
- Switching tab nhanh hơn vì không phải refetch mỗi lần user đổi tab.
- Một khuyến nghị có thể đổi nhóm ngay khi holdings/watchlist/cross impacts thay đổi trên client.

Quy tắc quan trọng:

- Không có tab `Đang theo dõi`; `/watchlist` đã là workflow riêng.
- `Đã theo dõi` chỉ là badge trên card.
- Expired/verified là nhóm tham khảo/học lại, không phải nhóm hành động mới.
- Direct impact phải scan nhanh hơn outside portfolio bằng visual weight và ordering.

### Portfolio

`/portfolio` trả lời 3 câu hỏi:

- Token nào trong ví đang có rủi ro?
- Token nào có khuyến nghị liên quan trực tiếp?
- Token nào thiếu giá hoặc dữ liệu không đủ?

Các section chính:

- Portfolio Summary
- Holdings List
- Data Quality Warnings
- Related Recommendations
- Indirect Impact

Mỗi holding row/card cần thể hiện:

- Token
- Balance
- Value
- Data status
- Related recommendation count
- Risk status
- CTA mở chi tiết nếu holding có khuyến nghị active

Nếu token thiếu giá, UI phải đánh dấu rõ. Tổng giá trị danh mục không được trình bày như số chắc chắn khi có missing price.

### Recommendation Detail

`/proposal/:id` user-facing title là:

```txt
Chi tiết khuyến nghị
```

First viewport có Decision Header trước rationale/evidence:

- tokenSymbol
- action
- confidence
- riskLevel
- expiresAt/timeLeft
- portfolioImpact
- status
- primaryAction
- disabledReason nếu có

Chỉ có 1 primary CTA nổi bật. Nếu expired hoặc thiếu dữ liệu quan trọng, CTA execute/trade bị ẩn hoặc disable.

Technical breakdown nằm phía dưới hoặc trong Advanced.

### Confidence Và Điểm Tín Hiệu

Phần giải thích chi tiết các con số confidence và quant/điểm tín hiệu vẫn cần được giữ trong UI, nhưng không đặt ở first viewport của decision flow. User nhìn quyết định trước, sau đó nếu muốn hiểu sâu thì mở các màn explanation.

Routes liên quan:

```txt
/proposal/:id/explanation
/proposal/:id/explanation/confidence
/proposal/:id/explanation/quant
/signals/:id/explanation
```

Files liên quan:

```txt
apps/web/app/proposal/[id]/explanation/page.tsx
apps/web/app/proposal/[id]/explanation/confidence/page.tsx
apps/web/app/proposal/[id]/explanation/quant/page.tsx
apps/web/app/signals/[id]/explanation/page.tsx
```

API dùng để giải thích:

| Dữ liệu | API | Dùng để làm gì |
| --- | --- | --- |
| Recommendation detail | `GET /api/proposals/:id` | Lấy token, action, confidence, quantScore, sources, result/check fields |
| Score explanation | `GET /api/proposals/:id/score-explanation` | Lấy formula, components, thresholds, audit trail, confidence factors |
| Signal detail | `GET /api/signals/:id` | Giải thích Layer 2 khi user đang ở signal audit route |

Nguyên tắc copy:

- User-facing gọi `confidence` là `độ tin cậy`.
- User-facing gọi `quant/quantScore` là `điểm tín hiệu`.
- Không nói confidence là xác suất chắc chắn có lời.
- Không dùng các công thức Layer 2 làm CTA chính.
- Raw component/debug chỉ ở explanation/Advanced.

#### Confidence Formula

Confidence nên được giải thích như độ tin cậy của luận điểm, không phải xác suất lời/lỗ.

Mô hình diễn giải trong UI:

```txt
Độ tin cậy =
  độ mạnh tín hiệu
  x chất lượng nguồn
  x độ mới dữ liệu
  x mức liên quan tới danh mục
  x penalty nếu thiếu dữ liệu
```

Các thành phần có thể hiển thị nếu API trả về:

| Thành phần | User-facing label | Ý nghĩa |
| --- | --- | --- |
| Signal strength | Độ mạnh tín hiệu | Tín hiệu có nổi bật so với nền dữ liệu hay không |
| Source quality | Chất lượng nguồn | Nguồn dữ liệu có đủ tin cậy/đa dạng không |
| Freshness | Độ mới dữ liệu | Dữ liệu còn đủ mới để ra quyết định không |
| Portfolio relevance | Mức liên quan danh mục | Tác động trực tiếp/gián tiếp tới tài sản user đang giữ |
| Missing data penalty | Điểm trừ dữ liệu thiếu | Giảm độ tin cậy nếu thiếu giá, nguồn hoặc mẫu dữ liệu |
| Verification adjustment | Điều chỉnh sau kiểm chứng | Nếu đã có kết quả kiểm chứng, dùng để giải thích vì sao nên tin/cẩn trọng hơn |

Empty/missing state:

```txt
Chưa đủ dữ liệu để giải thích độ tin cậy.
```

Không dùng:

```txt
confidenceDivisor
coldStartDivisor
model probability
pipeline score
```

trong UI thường. Các tên này chỉ được xuất hiện nếu nằm trong Advanced/Debug.

#### Quant / Điểm Tín Hiệu Formula

`quantScore` là điểm tín hiệu từ Layer 2. Trong UI mới, gọi là `Điểm tín hiệu`.

Mô hình diễn giải:

```txt
Điểm tín hiệu =
  điểm bất thường giá/volume
  + điểm bối cảnh thị trường
  + điểm thời điểm
  + điểm ảnh hưởng liên quan
  - điểm trừ nhiễu/dữ liệu thiếu
```

Các component Layer 2 có thể map sang copy như sau:

| Component kỹ thuật | User-facing label | Ý nghĩa |
| --- | --- | --- |
| finalScore | Điểm tín hiệu cuối | Điểm đã tổng hợp sau khi cộng/trừ các yếu tố |
| pureAlphaZ | Độ lệch bất thường | Token đang lệch khỏi nền so sánh như thế nào |
| crossZ | Ảnh hưởng liên quan | Tác động từ token/sự kiện khác tới token này |
| timeZ | Yếu tố thời điểm | Tín hiệu có xuất hiện đúng thời điểm đáng chú ý không |
| volatility | Độ biến động | Mức nhiễu/rủi ro từ biến động giá |
| sampleSize | Cỡ mẫu dữ liệu | Số điểm dữ liệu đủ hay còn mỏng |
| entropy | Độ nhiễu tín hiệu | Tín hiệu có rõ ràng hay bị phân tán |

Nếu token mới hoặc thiếu lịch sử:

```txt
Token còn ít lịch sử, điểm tín hiệu có thể biến động mạnh hơn bình thường.
```

Nếu thiếu source hoặc sample:

```txt
Chưa đủ nguồn dữ liệu để đọc điểm tín hiệu như một luận điểm mạnh.
```

#### Layer 2 Và Layer 3 Trong Explanation

Layer 2:

- Tạo tín hiệu định lượng.
- Giải thích score, component, nguồn, sample size, độ nhiễu.
- Không phải cơ hội hành động độc lập.

Layer 3:

- Chuyển tín hiệu thành khuyến nghị có action/risk/expiry.
- Là nguồn chính cho Decision Header và CTA.
- Quyết định user-facing dựa trên recommendation status, portfolio impact, risk và data quality.

Trong explanation UI, có thể nói:

```txt
Điểm tín hiệu đến từ dữ liệu định lượng. Khuyến nghị cuối cùng còn xét thêm rủi ro, độ mới dữ liệu và mức liên quan tới danh mục.
```

Không nên nói:

```txt
Layer 2 pipeline output quyết định execute.
```

vì câu này đẩy thuật ngữ backend/model vào user flow và làm sai ý nghĩa decision assistant.

### Scenario Và Trade Safety

`/proposal/:id/scenario`:

- `Dùng kịch bản này` chỉ route sang trade nếu khuyến nghị còn hiệu lực và đủ dữ liệu quyết định.
- Nếu expired: nút disabled, warning nói kịch bản chỉ còn để tham khảo.
- Nếu thiếu price/source/confidence: nút disabled, warning nói thiếu dữ liệu.

`/proposal/:id/trade`:

- Disable `Xác nhận vào lệnh` nếu expired.
- Disable nếu thiếu price/source/confidence.
- Disable nếu risk preview chưa tải được hoặc lỗi.
- Nếu preview ở trạng thái limited nhưng vẫn allowed, phải có confirmation trước khi execute.
- Expired recommendation không được route user vào execute flow mới từ card/scenario/detail.

### Trust / Advanced

`/model-health` và `/data-check` là Advanced/Trust Center, không phải workflow chính.

Ngôn ngữ user-facing:

- `Độ tin cậy hệ thống`
- `Kiểm tra rủi ro`
- `Kết quả kiểm chứng`
- `Điểm tín hiệu`

Raw status/config/metrics nếu có phải nằm trong phần được label rõ là Advanced/Debug.

### Shared Derivation Helpers

FE không giả định backend đã có `portfolioImpact`.

Helper chính:

```txt
apps/web/lib/utils/recommendationDerivation.ts
```

Derive:

- `portfolioImpact`: `DIRECT`, `INDIRECT`, `OUTSIDE`, `UNKNOWN`
- `status`: `ACTIVE`, `EXPIRING_SOON`, `EXPIRED`, `VERIFIED`, `EXECUTED`, `MISSING_DATA`
- `isWatched`

Quy tắc impact:

- Direct nếu `proposal.tokenSymbol` nằm trong holdings.
- Indirect nếu proposal xuất hiện trong cross impacts và không direct.
- Outside nếu không direct/indirect.
- Unknown nếu thiếu dữ liệu cần thiết.

## 2. Files Chính Đã Thay Đổi

Navigation/layout:

- `apps/web/app/components/layout/navigationItems.ts`
- `apps/web/app/components/layout/Navbar.tsx`
- `apps/web/app/components/layout/MobileBottomNav.tsx`

Core UI routes:

- `apps/web/app/overview/page.tsx`
- `apps/web/app/recommendations/page.tsx`
- `apps/web/app/recommendations/components/RecommendationCard.tsx`
- `apps/web/app/portfolio/page.tsx`
- `apps/web/app/watchlist/page.tsx`
- `apps/web/app/positions/page.tsx`
- `apps/web/app/positions/[id]/page.tsx`

Proposal flow:

- `apps/web/app/proposal/[id]/page.tsx`
- `apps/web/app/proposal/[id]/scenario/page.tsx`
- `apps/web/app/proposal/[id]/trade/page.tsx`
- `apps/web/app/proposal/[id]/explanation/page.tsx`
- `apps/web/app/proposal/[id]/explanation/confidence/page.tsx`
- `apps/web/app/proposal/[id]/explanation/quant/page.tsx`

Trust/advanced:

- `apps/web/app/data-check/page.tsx`
- `apps/web/app/model-health/page.tsx`

Shared helpers/components:

- `apps/web/app/components/shared/NdlUi.tsx`
- `apps/web/lib/utils/recommendationDerivation.ts`

Redirects:

- `apps/web/app/opportunities/page.tsx`
- `apps/web/app/opportunities/[id]/page.tsx`
- `apps/web/app/signals/page.tsx`

## 3. Cách Chạy Lại

Từ root repo:

```bash
npm run build
```

Typecheck riêng web nếu cần:

```bash
./node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
```

Dev server:

```bash
npm --workspace @gr2/web run dev
```

Nếu chạy trong WSL mà npm bị trỏ sang Windows shim, dùng Node trong WSL hoặc chạy theo môi trường dev local đã setup sẵn.

## 4. Checklist Test Lại Version Mới

### A. Navigation

Test desktop navbar và mobile bottom nav:

- Chỉ có 5 mục: `Tổng quan`, `Danh mục`, `Khuyến nghị`, `Theo dõi`, `Vị thế`.
- Không có `Alerts`, `Diagnostics`, `Model Health`, `Opportunities`.
- Brand/copy không nói app là dashboard nội bộ.

Route cần check:

```txt
/overview
/portfolio
/recommendations
/watchlist
/positions
```

Expected:

- Nav active state đúng.
- Mobile bottom nav đồng bộ desktop.

### B. Overview

Mở:

```txt
/overview
```

Expected:

- Có câu hỏi/product framing kiểu hôm nay danh mục cần xử lý gì.
- Có TrustBadge nhỏ, không chiếm main workflow.
- Có title `Cần xử lý ngay`.
- Có 4 metrics: tổng giá trị, việc cần xử lý, rủi ro cần chú ý, tín hiệu sắp hết hạn.
- Today Action Queue tối đa 5 item.
- Nếu nhiều hơn 5 item, có CTA `Xem tất cả khuyến nghị`.
- Nếu không có item, thấy `Không có việc cần xử lý ngay`.
- Card có token, action, confidence, risk, expiry/timeLeft, portfolio impact, short reason, CTA.
- Risk Banner xuất hiện khi missing price, stale data, hoặc expired risk.

### C. Recommendation Center

Mở từng tab:

```txt
/recommendations?tab=urgent
/recommendations?tab=portfolio
/recommendations?tab=outside-portfolio
/recommendations?tab=verified
/recommendations?tab=expired
```

Expected:

- Có đủ 5 tabs.
- Không có tab `Đang theo dõi`.
- `/recommendations?tab=outside-portfolio` hiển thị nhóm ngoài danh mục.
- Direct/portfolio items dễ scan hơn outside portfolio.
- Card badge order đúng: action -> impact -> risk -> expiry/status -> watched.
- CTA chính là `Xem chi tiết`.
- CTA `Theo dõi` nếu có thì là secondary.
- Expired tab muted, không có execute/trade CTA.
- Mobile card single-column, CTA nằm dưới content.

### D. Portfolio

Mở:

```txt
/portfolio
```

Expected:

- Page trả lời rõ token nào có rủi ro, token nào có khuyến nghị trực tiếp, token nào thiếu giá.
- Có sections: summary, holdings, data quality warnings, related recommendations, indirect impact.
- Holding row/card có token, balance, value, dataStatus, relatedRecommendationCount, riskStatus.
- Token thiếu giá được đánh dấu rõ.
- Khi có missing price, tổng giá trị không được diễn đạt như số chắc chắn.
- Holding có active recommendation có CTA mở detail.

### E. Recommendation Detail

Mở một khuyến nghị còn hiệu lực:

```txt
/proposal/:id
```

Expected:

- Title user-facing là `Chi tiết khuyến nghị`.
- Decision Header nằm trước rationale/evidence.
- Header có token, action, confidence, risk, timeLeft, portfolioImpact, status.
- Chỉ có 1 primary CTA nổi bật.
- Technical breakdown nằm dưới hoặc trong Advanced.

Mở một khuyến nghị expired hoặc thiếu dữ liệu:

Expected:

- Không trình bày như cơ hội hành động mới.
- Execute/trade CTA bị disable hoặc ẩn.
- Có disabledReason/warning rõ.

### F. Scenario

Mở:

```txt
/proposal/:id/scenario
```

Expected với khuyến nghị active và đủ dữ liệu:

- Có nút `Dùng kịch bản này`.
- Nút route sang `/proposal/:id/trade?amount=...&leverage=...`.

Expected với expired:

- Nút bị disabled hoặc đổi sang `Đã hết hiệu lực`.
- Có warning: kịch bản chỉ còn để tham khảo.
- Không route sang trade flow mới.

Expected với missing data:

- Nút bị disabled hoặc đổi sang `Thiếu dữ liệu để vào lệnh`.
- Có warning thiếu price/source/confidence.

### G. Trade

Mở:

```txt
/proposal/:id/trade
```

Expected:

- Nếu expired: `Xác nhận vào lệnh` disabled, có warning.
- Nếu thiếu price/source/confidence: disabled, có warning.
- Nếu risk preview lỗi hoặc chưa có preview: disabled, có warning.
- Nếu preview limited nhưng allowed: bấm execute phải hiện confirmation trước.
- Không dùng wording `execute` như CTA user-facing; dùng `Xác nhận vào lệnh`.

### H. Watchlist

Mở:

```txt
/watchlist
```

Expected:

- Không còn CTA/copy `Xem proposal`.
- Confirm delete không nói `proposal`.
- Dùng `khuyến nghị`, `theo dõi`, `đã có kết quả`, `đã hết hạn`.

### I. Positions

Mở:

```txt
/positions
/positions/:id
```

Expected:

- Không dùng `paper trading từ proposal` trong description.
- Empty state không dùng `position sẽ`.
- Copy hướng user/trader: `vị thế`, `mô phỏng`, `khuyến nghị`, `vào lệnh`.

### J. Trust / Advanced

Mở:

```txt
/data-check
/model-health
```

Expected:

- Page được frame là Advanced/Trust Center.
- Không có cảm giác main dashboard workflow.
- Raw status/config nếu có phải nằm trong phần Advanced/Debug.
- Status chính được dịch sang user-facing, ví dụ `Đang dùng được`, `Cần thận trọng`, `Không nên dựa vào`.

### K. Copy Leak Scan

Scan nhanh user-facing copy trong các route:

```txt
/recommendations
/portfolio
/watchlist
/positions
/signals
/data-check
/model-health
/proposal/:id
/proposal/:id/scenario
/proposal/:id/trade
/proposal/:id/explanation
```

Không nên thấy ở UI thường:

- `Proposal`
- `Quant`
- `Cross-impact`
- `Diagnostics`
- `Model Health`
- `Backtest`
- API path dạng `/api/...`
- `config`, `lifecycle`, `pipeline`, `model config`, `BE`

Ngoại lệ:

- Code identifiers.
- API route source code.
- Advanced/Debug area có label rõ.

## 5. Acceptance Criteria Cần Giữ

Sprint 1:

- Main nav tối đa 5 mục.
- Mobile nav không có alerts/diagnostics/model-health/opportunities.
- Overview có `Cần xử lý ngay`.
- Today action card có token, action, confidence, risk, expiry, portfolio impact.
- Detail page có Decision Header trước rationale/evidence.
- Không còn chữ `Proposal` trong nav, card title, empty state, CTA user-facing.
- Expired signal/recommendation không được trình bày như cơ hội hành động mới.
- Có disclaimer và warning cho stale/missing/expired data.

Sprint 2:

- `/recommendations?tab=outside-portfolio` hoạt động.
- Recommendation Center có đủ 5 tabs.
- Recommendation card có portfolioImpact/status/isWatched/risk/expiry rõ ràng.
- Expired tab muted, không có execute/trade CTA.
- Portfolio page hiển thị related recommendation count theo holding.
- Missing price/data quality warning nổi bật trên portfolio.
- Trust/model page không còn cảm giác main nav/dashboard nội bộ.
- Không còn backend/API wording trong user-facing copy ngoài Advanced/Debug.
- Typecheck/build pass.

## 6. Kết Quả Verify Gần Nhất

Đã chạy:

```bash
./node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
npm run build
```

Kết quả:

- Typecheck web: pass.
- Production build: pass.

Các fix review Sprint 2 đã xác nhận bằng scan:

- Không còn `Xem proposal`.
- Không còn `Xóa proposal`.
- Không còn `paper trading từ proposal`.
- Không còn `position sẽ`.
- Không còn raw `QUANT_READY` render từ shared SignalCard.
