# Nhật ký sửa UI Backtest trang Proposal Detail

Ngày sửa: 10/06/2026

## Phạm vi

Phần được sửa nằm ở trang Proposal Detail, cụ thể là khu vực Backtest Token và bảng kiểm chứng lịch sử.

Các file đã chỉnh:

- `apps/web/app/api/proposals/[id]/timeline/route.ts`
- `apps/web/app/proposal/[id]/ProposalAccuracyChart.tsx`
- `apps/web/app/proposal/[id]/page.tsx`
- `apps/web/lib/hooks/useNdlData.ts`

## 1. Làm rõ nguồn thời điểm của marker Backtest

### Vấn đề trước khi sửa

Trong bảng Backtest và marker trên biểu đồ, cột "Thời điểm" gây khó hiểu vì UI chỉ hiển thị một timestamp nhưng không nói rõ timestamp đó lấy từ đâu.

Người đọc khó biết thời điểm đó là:

- thời điểm tín hiệu được ghi nhận,
- thời điểm backtest ghi nhận,
- hay thời điểm proposal được tạo.

Điều này dễ tạo cảm giác biểu đồ và bảng bị lệch thời gian, đặc biệt khi database có nhiều field thời gian khác nhau.

### Cách sửa

Trong API `GET /api/proposals/[id]/timeline`, thêm field `dateSource` cho từng marker.

Logic lấy thời điểm marker hiện tại:

1. Ưu tiên `proposal.backtestMeta.detectedAt`.
2. Nếu không có thì dùng `backtest.detectedAt`.
3. Nếu không có thì dùng `proposal.createdAt`.
4. Nếu tất cả đều thiếu thì đánh dấu `UNKNOWN`.

Field mới trả về:

```ts
dateSource:
  | 'SIGNAL_DETECTED_AT'
  | 'BACKTEST_DETECTED_AT'
  | 'PROPOSAL_CREATED_AT'
  | 'UNKNOWN'
```

### File sửa

- `apps/web/app/api/proposals/[id]/timeline/route.ts`
- `apps/web/lib/hooks/useNdlData.ts`

### Kết quả

UI có thể hiển thị rõ nguồn thời điểm, ví dụ:

- `Thời điểm tín hiệu`
- `Thời điểm backtest`
- `Thời điểm tạo proposal`
- `Không rõ nguồn thời điểm`

Nhờ vậy khi kiểm tra một marker, người dùng biết timestamp đang đại diện cho mốc nào.

## 2. Đổi cột thời điểm trong bảng Backtest

### Vấn đề trước khi sửa

Bảng cũ dùng nhãn chung là `Thời điểm`, không đủ rõ nghĩa.

Với dữ liệu trading/backtest, "thời điểm" có thể bị hiểu là:

- thời điểm tạo proposal,
- thời điểm giá được khớp,
- thời điểm vào lệnh,
- thời điểm kiểm chứng,
- hoặc thời điểm tín hiệu xuất hiện.

### Cách sửa

Đổi header bảng thành:

```text
Thời điểm tín hiệu (giờ VN)
```

Bên dưới timestamp, UI hiển thị thêm dòng nhỏ cho biết nguồn thời điểm, lấy từ `dateSource`.

Ví dụ:

```text
12:33 09/06/2026
Thời điểm tín hiệu
```

### File sửa

- `apps/web/app/proposal/[id]/ProposalAccuracyChart.tsx`

### Kết quả

Bảng dễ đọc hơn và giảm nhầm lẫn giữa thời điểm tín hiệu với thời điểm giá khớp.

## 3. Làm rõ giá hiển thị trong bảng và tooltip

### Vấn đề trước khi sửa

Cột giá trước đây hiển thị kiểu:

```text
207,632 US$
```

Cách hiển thị này dễ gây hiểu nhầm vì dấu phẩy có thể bị đọc thành phân tách hàng nghìn theo thói quen tiếng Anh, hoặc thành dấu thập phân theo thói quen tiếng Việt.

Ngoài ra cột chỉ ghi `Giá` hoặc `Giá / trạng thái giá`, chưa nói rõ đây là giá nào.

### Cách sửa

Đổi nhãn cột thành:

```text
Giá khớp / trạng thái
```

Thêm formatter riêng cho giá token:

```ts
formatTokenUsd(value)
```

Giá hiển thị theo locale Việt Nam và đơn vị rõ hơn:

```text
207.632,00 USD
```

Nếu có giá khớp, bảng hiển thị:

```text
207.632,00 USD
Khớp 12:33 09/06/2026, lệch 5 phút
```

Nếu không có giá đủ gần để đặt marker, bảng hiển thị trạng thái:

```text
Thiếu giá quanh thời điểm
Không đặt marker
```

### File sửa

- `apps/web/app/proposal/[id]/ProposalAccuracyChart.tsx`

### Kết quả

Người dùng hiểu rõ giá trong bảng là giá khớp gần nhất quanh thời điểm tín hiệu, không phải nhất thiết là giá đúng tuyệt đối tại timestamp tín hiệu.

## 4. Sửa trạng thái Pending trong bảng Backtest

### Vấn đề trước khi sửa

Với các khuyến nghị đang chờ kiểm chứng, bảng hiển thị cùng một câu dài ở cả hai cột:

```text
Kết quả: Đang chờ kiểm chứng sau 24h
PnL: Đang chờ kiểm chứng sau 24h
```

Điều này bị lặp nghĩa và làm bảng rối.

### Cách sửa

Giữ thông tin pending ở cột `Kết quả`.

Cột `PnL` chỉ hiển thị `-` khi chưa có PnL.

Kết quả sau sửa:

```text
Kết quả: Đang chờ kiểm chứng sau 24h
PnL: -
```

### File sửa

- `apps/web/app/proposal/[id]/ProposalAccuracyChart.tsx`

### Kết quả

Bảng gọn hơn, không lặp thông tin, và đúng nghĩa dữ liệu: chưa kiểm chứng thì chưa có PnL.

## 5. Bỏ cảnh báo bị lặp về marker không vẽ được

### Vấn đề trước khi sửa

UI có hai nơi cùng nói về việc một số khuyến nghị không được đặt marker lên biểu đồ.

Một cảnh báo nằm trong khối chất lượng dữ liệu, một cảnh báo khác nằm ngay trước bảng.

Điều này làm người dùng có cảm giác lỗi nghiêm trọng hơn thực tế.

### Cách sửa

Xóa cảnh báo unplotted marker khỏi hàm `buildTimelineWarnings`.

Chỉ giữ một cảnh báo duy nhất gần bảng, vì bảng là nơi vẫn hiển thị các dòng không vẽ được marker.

Nội dung mới:

```text
Có X khuyến nghị chỉ hiển thị trong bảng vì không tìm được giá đủ gần với thời điểm ghi nhận tín hiệu.
Các dòng này vẫn được giữ để bạn kiểm tra lịch sử, nhưng không đặt marker lên đường giá.
```

### File sửa

- `apps/web/app/proposal/[id]/ProposalAccuracyChart.tsx`

### Kết quả

Thông báo rõ hơn và không bị lặp.

## 6. Đổi tiêu đề cảnh báo dữ liệu nhẹ hơn

### Vấn đề trước khi sửa

Tiêu đề cũ:

```text
Chất lượng dữ liệu cần chú ý
```

Tiêu đề này khá nặng, dễ làm người dùng nghĩ dữ liệu bị lỗi lớn.

### Cách sửa

Đổi thành:

```text
Ghi chú dữ liệu
```

### File sửa

- `apps/web/app/proposal/[id]/ProposalAccuracyChart.tsx`

### Kết quả

Giọng UI trung tính hơn, phù hợp với mục đích giải thích dữ liệu tham khảo.

## 7. Làm rõ bảng chỉ hiển thị 8 dòng gần nhất

### Vấn đề trước khi sửa

Card tổng quan có thể hiển thị:

```text
Số khuyến nghị tương tự: 80
```

Nhưng bảng phía dưới chỉ hiện 8 dòng.

Nếu không giải thích, người dùng sẽ thắc mắc vì sao số lượng trên summary và bảng không khớp.

### Cách sửa

Thêm dòng mô tả phía trên bảng:

```text
Hiển thị 8 khuyến nghị gần nhất trong tổng số 80.
72 khuyến nghị cũ hơn đang được tính trong thống kê nhưng không hiển thị trong bảng này.
```

Nếu tổng số nhỏ hơn hoặc bằng 8:

```text
Toàn bộ khuyến nghị đang được hiển thị trong bảng này.
```

### File sửa

- `apps/web/app/proposal/[id]/ProposalAccuracyChart.tsx`

### Kết quả

Người dùng hiểu vì sao summary và bảng khác số lượng.

## 8. Làm rõ Win-rate và ROI trung bình tính trên toàn bộ lịch sử

### Vấn đề trước khi sửa

Người dùng có thể hiểu nhầm Win-rate và ROI trung bình được tính từ 8 dòng đang nhìn thấy trong bảng.

Thực tế các chỉ số này được tính từ toàn bộ dữ liệu lịch sử tương tự mà API trả về.

### Cách sửa

Thêm câu giải thích dưới phần cảnh báo dữ liệu tham khảo:

```text
Win-rate và ROI trung bình được tính trên toàn bộ lịch sử tương tự, không chỉ 8 dòng gần nhất trong bảng.
```

### File sửa

- `apps/web/app/proposal/[id]/ProposalAccuracyChart.tsx`

### Kết quả

Giảm nhầm lẫn giữa thống kê tổng quan và bảng rút gọn.

## 9. Thêm cảnh báo khi marker bị chồng lên nhau

### Vấn đề trước khi sửa

Một số marker có thể rất gần nhau về thời điểm và giá, nên trên biểu đồ nhìn giống như chỉ có một điểm.

Trong khi đó bảng vẫn có nhiều dòng tương ứng.

Điều này khiến người dùng nghĩ biểu đồ thiếu marker.

### Cách sửa

Thêm logic đếm marker trùng gần nhau theo bucket:

- làm tròn thời gian theo phút,
- gom theo giá gần tương đương.

Nếu có marker overlap, UI hiển thị note:

```text
Có X marker trùng rất gần nhau về thời điểm và giá, nên trên biểu đồ có thể nhìn như một điểm duy nhất.
Bảng bên dưới vẫn liệt kê từng khuyến nghị riêng.
```

### File sửa

- `apps/web/app/proposal/[id]/ProposalAccuracyChart.tsx`

### Kết quả

Giải thích được trường hợp số điểm nhìn thấy trên chart ít hơn số dòng dữ liệu trong bảng.

## 10. Bỏ legend "Dữ liệu hạn chế"

### Vấn đề trước khi sửa

Legend của chart luôn hiển thị:

```text
Dữ liệu hạn chế
```

Trong khi UI không kiểm tra chắc chắn chart hiện tại có marker dữ liệu hạn chế hay không.

Điều này dễ làm người dùng nghĩ biểu đồ đang có dữ liệu hạn chế ngay cả khi không có.

### Cách sửa

Tạm bỏ legend `Dữ liệu hạn chế` khỏi phần legend của Backtest.

### File sửa

- `apps/web/app/proposal/[id]/page.tsx`

### Kết quả

Legend chỉ còn các trạng thái chắc chắn đang dùng:

- Mua
- Bán
- Giữ
- Win
- Loss
- Hòa vốn

## 11. Kiểm tra sau khi sửa

Đã chạy TypeScript check:

```bash
tsc -p apps/web/tsconfig.json --noEmit
```

Kết quả: không có lỗi TypeScript.

## Tóm tắt thay đổi theo API và UI

### API thay đổi

Endpoint:

```text
GET /api/proposals/[id]/timeline
```

Marker trả thêm:

```ts
dateSource?: 'SIGNAL_DETECTED_AT' | 'BACKTEST_DETECTED_AT' | 'PROPOSAL_CREATED_AT' | 'UNKNOWN'
```

Mục đích:

- giúp FE biết timestamp của marker đến từ field nào,
- hỗ trợ debug lệch giờ/lệch marker,
- giúp UI giải thích rõ cho người dùng.

### UI thay đổi

Backtest chart/table được sửa để:

- không lặp cảnh báo,
- không lặp text pending,
- hiển thị giá rõ đơn vị,
- nói rõ giá là giá khớp gần nhất,
- nói rõ bảng chỉ hiển thị 8 dòng gần nhất,
- nói rõ thống kê summary tính trên toàn bộ lịch sử,
- giải thích trường hợp marker chồng lên nhau,
- bỏ legend gây hiểu nhầm.

---

# Nhật ký sửa UI Confidence/Quant trang Proposal Detail

Ngày sửa: 10/06/2026

## Phạm vi

Phần được sửa nằm trong khối `Chi tiết khuyến nghị` của trang Proposal Detail, cụ thể là hai chỉ số:

- `Độ tin cậy` / Confidence
- `Điểm tín hiệu` / Quant Z-Score

File đã chỉnh:

- `apps/web/app/proposal/[id]/page.tsx`

## 1. Vấn đề UI trước khi sửa

Trong phần `Chi tiết khuyến nghị`, hai nút `Cách tính` đang hiển thị như text link nhỏ nằm sát giá trị score.

Các vấn đề chính:

- Nút nhỏ, khó bấm, không giống một action rõ ràng.
- Text `Cách tính` làm cụm số bị rối, đặc biệt khi nằm trong card nhỏ.
- Không có icon nên người dùng khó nhận biết đây là nút mở giải thích.
- Khi mở drawer, nội dung chủ yếu là text, thiếu visualization để đọc nhanh Confidence và Quant.
- Với dashboard tài chính, chỉ số score nên có visual encoding rõ ràng hơn để tránh người dùng phải đọc nhiều đoạn mô tả.

## 2. Review UX theo vai trò Senior Frontend/Data Visualization

### Confidence

Confidence là chỉ số từ 0-100%, phù hợp để hiển thị bằng progress bar.

Lý do:

- Người dùng tài chính quen với thang độ mạnh/yếu.
- Dễ scan nhanh hơn so với chỉ nhìn số.
- Có thể áp dụng threshold màu:
  - `< 50`: thấp, màu đỏ.
  - `50 - 75`: cần kiểm tra, màu vàng.
  - `> 75`: mạnh, màu xanh.

Rủi ro cần tránh:

- Không nên trình bày Confidence như xác suất chắc thắng.
- Không nên dùng màu xanh quá mạnh khiến người dùng hiểu là "an toàn tuyệt đối".
- Cần nhắc rằng Confidence là độ tin cậy của luận điểm, không phải cam kết lợi nhuận.

### Quant Z-Score

Quant là điểm có thể âm hoặc dương, nên progress bar một chiều không phù hợp.

Giải pháp phù hợp hơn là gauge hai chiều:

- Mốc `0` ở giữa.
- Bên trái là bearish/đỏ.
- Bên phải là bullish/xanh.
- Marker thể hiện vị trí score hiện tại.

Lý do:

- Quant dương và âm có ý nghĩa đối nghịch.
- Người dùng nhìn được hướng tín hiệu ngay lập tức.
- Phù hợp với logic Layer 2: `finalScore > 0` là bullish, `< 0` là bearish.

Rủi ro cần tránh:

- Z-Score có thể outlier rất lớn, nếu vẽ nguyên giá trị sẽ làm gauge bị méo.
- Cần kẹp vùng hiển thị, ví dụ `-3` đến `+3`, nhưng vẫn giữ số thật ở text.
- Không nên show công thức toán học dài trong UI chính; nên show yếu tố đóng góp chính.

## 3. Thay đổi nút mở giải thích

### Trước khi sửa

Nút là text nhỏ:

```text
Cách tính
```

Nút nằm sát số, ví dụ:

```text
71% Cách tính
25,8 Cách tính
```

### Sau khi sửa

Đổi thành pill button có icon:

```text
? Giải thích
```

UI mới dùng:

- icon `HelpCircle` từ `lucide-react`,
- border cyan nhẹ,
- background cyan trong suốt,
- hover state rõ hơn,
- focus ring rõ hơn cho keyboard navigation,
- `title="Xem cách tính"`.

### Lý do đổi chữ từ "Cách tính" sang "Giải thích"

Với người dùng cuối, "Cách tính" dễ tạo kỳ vọng sẽ thấy công thức toán học.

Trong khi mục tiêu UX tốt hơn là giải thích:

- chỉ số này nghĩa là gì,
- nó mạnh/yếu ra sao,
- dữ liệu nào đang ảnh hưởng,
- có thiếu dữ liệu nào cần kiểm tra không.

Vì vậy `Giải thích` phù hợp hơn với sản phẩm tài chính/Web3.

## 4. Thêm Confidence Progress Bar

### Cách sửa

Thêm component:

```ts
ConfidenceMeter
```

Component này:

- normalize Confidence về thang 0-100,
- hỗ trợ cả dữ liệu dạng `0.71` hoặc `71`,
- clamp trong vùng 0-100,
- đổi màu theo threshold,
- hiển thị nhãn trạng thái.

### Logic màu

```text
< 50   -> Thấp        -> đỏ
50-75  -> Cần kiểm tra -> vàng
>= 75  -> Mạnh        -> xanh
```

### Copy giải thích

Drawer Confidence có thêm mô tả:

```text
Chỉ số này đo mức đáng tin của luận điểm sau khi xét độ mạnh tín hiệu, cỡ mẫu, nguồn và dữ liệu thiếu. Đây không phải xác suất chắc chắn có lời.
```

### Kết quả

Người dùng nhìn được ngay:

- Confidence hiện tại là bao nhiêu phần trăm,
- đang thuộc vùng thấp/cần kiểm tra/mạnh,
- đây không phải xác suất có lời.

## 5. Thêm Quant Bi-directional Gauge

### Cách sửa

Thêm component:

```ts
QuantGauge
```

Component này:

- nhận `finalScore`,
- hiển thị số thật,
- vẽ gauge từ bearish sang bullish,
- đặt mốc `0` ở giữa,
- đặt marker theo score,
- kẹp hiển thị trong vùng `-3` đến `+3`.

### Logic diễn giải

```text
score > 1   -> Nghiêng bullish
score < -1  -> Nghiêng bearish
-1..1       -> Gần trung lập
```

### Copy giải thích

Drawer Quant có thêm mô tả:

```text
Điểm dương cho thấy tín hiệu nổi bật theo hướng bullish; điểm âm nghiêng bearish. Gauge được kẹp trong vùng -3 đến +3 để tránh một outlier làm méo hiển thị.
```

### Vì sao kẹp gauge ở -3 đến +3?

Quant là Z-Score, có thể xuất hiện giá trị rất lớn khi dữ liệu đột biến.

Nếu vẽ trực tiếp giá trị outlier, marker sẽ làm hỏng thang đo và các điểm bình thường trở nên khó đọc.

Vì vậy:

- UI gauge dùng vùng hiển thị ổn định `-3..+3`,
- text vẫn hiển thị score thật,
- người dùng vẫn biết tín hiệu mạnh/yếu mà không bị méo layout.

## 6. Liên hệ với logic Core Layer 2

Đã rà logic trong core, đặc biệt:

- `core/signal-detector/src/quant-engine.ts`
- `core/signal-detector/src/alpha-analyzer.ts`
- `core/signal-detector/src/types.ts`

Luồng tính Quant chính:

1. Document scoring: xử lý tweet/news, sentiment, trọng số nguồn.
2. Token aggregation: gom dữ liệu theo token.
3. Alpha/cross evaluation:
   - `timeZ`: độ lệch so với lịch sử token.
   - `pureAlphaZ`: loại bớt tác động thị trường chung/BTC.
   - `crossZ`: mức nổi bật so với các token khác cùng thời điểm.
   - `finalScore`: blend giữa `pureAlphaZ` và `crossZ`.

Logic action:

- `finalScore > actionThreshold` -> BUY.
- `finalScore < -actionThreshold` -> SELL.
- gần vùng trung lập -> HOLD/WATCH.

Logic Confidence:

- token đủ lịch sử dùng `abs(finalScore) / confidenceDivisor`,
- token cold-start bị cap thấp hơn,
- cỡ mẫu ít bị penalty.

Vì vậy UI mới không show công thức thô, mà ưu tiên:

- hướng tín hiệu,
- độ mạnh,
- vùng threshold,
- yếu tố giải thích,
- cảnh báo dữ liệu thiếu.

## 7. Các task triển khai đã hoàn thành

### Task: Improve Score Help Buttons

Priority: High

Acceptance Criteria:

- Hai action trong card không còn là text link nhỏ.
- Có icon hỗ trợ nhận diện.
- Hover/focus state rõ ràng.
- Không làm vỡ layout card nhỏ.

Technical Note:

- Dùng `HelpCircle` từ `lucide-react`.
- Sửa component `StatWithHelp`.

Trạng thái: hoàn thành.

### Task: Implement Confidence Progress UI

Priority: High

Acceptance Criteria:

- Confidence có progress bar.
- Màu đổi theo 3 ngưỡng đỏ/vàng/xanh.
- Có nhãn trạng thái.
- Có copy nhắc rằng đây không phải xác suất chắc chắn có lời.

Technical Note:

- Thêm `ConfidenceMeter`.
- Thêm helper `normalizeConfidencePercent` và `getConfidenceTone`.

Trạng thái: hoàn thành.

### Task: Implement Quant Bi-directional Gauge

Priority: High

Acceptance Criteria:

- Quant hiển thị bằng gauge hai chiều.
- Mốc `0` ở giữa.
- Bên trái bearish, bên phải bullish.
- Marker phản ánh score hiện tại.
- Outlier không làm hỏng layout.

Technical Note:

- Thêm `QuantGauge`.
- Kẹp vùng visual `-3..+3`.

Trạng thái: hoàn thành.

### Task: Keep Explanation Trustworthy But Not Overloaded

Priority: Medium

Acceptance Criteria:

- Drawer vẫn giữ các section giải thích theo yếu tố.
- Không đưa công thức toán học dài vào UI chính.
- Người dùng thấy visual trước, chi tiết sau.

Technical Note:

- Đặt `ConfidenceMeter` và `QuantGauge` lên đầu nội dung drawer.
- Giữ các `DrawerSection` hiện có bên dưới.

Trạng thái: hoàn thành.

## 8. Kiểm tra sau khi sửa

Đã chạy TypeScript check:

```bash
tsc -p apps/web/tsconfig.json --noEmit
```

Kết quả: không có lỗi TypeScript.

## 9. Ghi chú còn lại

Chưa verify bằng browser screenshot trong lượt này vì browser tool không khả dụng.

Phần cần kiểm tra thủ công tiếp theo trên UI:

- mở `/proposal/[id]`,
- kiểm tra card `Độ tin cậy`,
- kiểm tra card `Điểm tín hiệu`,
- bấm `Giải thích` ở từng card,
- kiểm tra drawer trên desktop và mobile width,
- đảm bảo gauge không bị tràn khi Quant quá lớn hoặc thiếu dữ liệu.
