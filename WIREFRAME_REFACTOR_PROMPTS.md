# NDL Wireframe Refactor Prompts

File này chứa các prompt để audit, hoàn thiện, và refactor các màn UI theo wireframe mới. Trước khi dùng prompt, nên đọc `WIREFRAME_CONTEXT.md`, `UI2.md`, và `FE_UI.md`.

Lưu ý trạng thái code hiện tại:

- Một số màn đã được refactor một phần hoặc gần đủ theo wireframe mới.
- Khi chạy prompt, luôn audit màn hiện tại trước, ghi rõ phần đã đạt và phần còn thiếu, rồi chỉ sửa gap còn thiếu.
- Không rewrite toàn bộ màn nếu cấu trúc hiện tại đã đạt acceptance criteria.
- Không refactor unrelated files.

## Recommended Run Order

Chạy theo thứ tự này để giảm rủi ro phá UI đã đúng:

1. Prompt 0 - Global guardrails.
2. Prompt 3 - Recommendation Center filters + URL params.
3. Prompt 10 - Shared Explanation Drawer component.
4. Prompt 4 - Proposal detail header gap audit, đặc biệt `Cách tính`.
5. Prompt 5 - Confidence Explanation Drawer.
6. Prompt 6 - Signal Score Explanation Drawer.
7. Prompt 7 - Backtest TOKEN section.
8. Prompt 8 - Trade safety audit, chỉ nếu route scenario/trade tồn tại.
9. Prompt 1 - Overview audit/fill gaps.
10. Prompt 2 - Portfolio audit/fill gaps.
11. Prompt 11 - Copy and terminology cleanup.
12. Prompt 12 - Final QA.

Ghi chú:

- Prompt 1 và Prompt 2 nên chạy sau các prompt detail/filter vì `/overview` và `/portfolio` hiện đã khớp nhiều tiêu chí.
- Prompt 3 đã bao gồm filter state/search params, không cần chạy Prompt 9 riêng.
- Nếu một route trong Prompt 8 không tồn tại, không tự tạo route mới trừ khi user yêu cầu.

## Prompt 0: Global UI/UX Refactor Guardrails

```txt
Bạn là senior frontend engineer + UI/UX designer cho NDL, một personal crypto decision assistant.

Hãy audit và refactor UI theo các nguyên tắc sau:

- Portfolio-first, signal-second.
- Decision before explanation.
- User language before system language.
- Technical data chỉ nằm trong Advanced/Debug/Explanation.
- Không dùng chữ "Proposal" trong UI user-facing; dùng "Khuyến nghị".
- Không dùng "Quant" trong UI user-facing; dùng "Điểm tín hiệu".
- Không hiển thị API path trong UI thường.
- Expired/verified/executed recommendation không được trình bày như cơ hội hành động mới.
- Missing price/source/confidence phải có warning rõ và không được cho user đi thẳng vào execute/trade.
- Mỗi first viewport chỉ có 1 primary CTA nổi bật.
- CTA trên recommendation card/list nên là "Xem chi tiết" hoặc "Chuẩn bị giao dịch", không dùng "Thực thi" quá sớm.
- Dùng lại logic có sẵn trong `apps/web/lib/utils/recommendationDerivation.ts`:
  - `deriveRecommendationStatus`
  - `derivePortfolioImpact`
  - `deriveIsWatched`
  - `hasMissingDecisionData`
- Không duplicate logic status/impact ở component nếu có thể reuse helper.

Hãy đọc các file:

- `WIREFRAME_CONTEXT.md`
- `UI2.md`
- `FE_UI.md`
- `apps/web/lib/hooks/useNdlData.ts`
- `apps/web/lib/utils/recommendationDerivation.ts`

Trước khi sửa:

- Đọc file hiện tại.
- Ghi rõ phần đã đạt acceptance criteria.
- Ghi rõ gap còn thiếu.
- Chỉ sửa gap còn thiếu, không rewrite màn đã đúng.

Sau khi refactor, chạy:

- `npm run build`
- hoặc `./node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`

Không refactor unrelated files.
```

## Prompt 1: Audit/Fix `/overview` Today Decision Inbox

```txt
Hãy audit màn `/overview` trong `apps/web/app/overview/page.tsx` so với Today Decision Inbox dưới đây.

Quan trọng:

- Màn này có thể đã được refactor một phần hoặc gần đủ.
- Trước khi sửa, liệt kê phần đã đạt và phần còn thiếu.
- Chỉ bổ sung/chỉnh gap còn thiếu.
- Không rewrite toàn bộ layout nếu cấu trúc hiện tại đã đạt yêu cầu.

Mục tiêu UX:

User mở app lên phải trả lời được trong 5 giây:

"Hôm nay danh mục crypto của tôi cần xử lý gì?"

Yêu cầu layout:

1. Header
   - Eyebrow: `Tổng quan`.
   - Title: `Hôm nay danh mục của tôi cần xử lý gì?`.
   - Description ngắn: NDL ưu tiên token user đang giữ, sau đó mới tới tín hiệu ngoài danh mục.
   - Actions:
     - Trust badge nhỏ: `Hệ thống ổn định` / `Dữ liệu hạn chế` / `Đang cập nhật`.
     - Freshness badge: `Cập nhật: ...`.

2. Top metrics gồm đúng 4 card:
   - `Tổng giá trị danh mục`.
   - `Việc cần xử lý hôm nay`.
   - `Rủi ro cần chú ý`.
   - `Tín hiệu sắp hết hạn`.

3. Risk banner
   - Hiện khi thiếu giá, thiếu dữ liệu quyết định, expired unverified, hoặc stale data.
   - Copy user-facing: `Dữ liệu cần kiểm tra trước khi hành động`.
   - Nếu missing price, nói rõ tổng giá trị danh mục có thể chưa đầy đủ.

4. Section `Cần xử lý ngay`
   - Hiển thị tối đa 5 items.
   - Nếu có hơn 5, CTA: `Xem tất cả khuyến nghị`.
   - Empty state: `Không có việc cần xử lý ngay`.
   - Card phải có:
     - Token.
     - Action badge.
     - Portfolio impact badge.
     - Risk badge.
     - Expiry/status badge.
     - Confidence.
     - Optional quick link/button `Cách tính` nếu có thể làm gọn.
     - Short reason.
     - CTA chính: `Xem chi tiết`.
     - CTA phụ: `Theo dõi` nếu chưa watched và còn hợp lệ.
   - Không dùng CTA `Thực thi` ở overview.

5. Holdings snapshot
   - Token, số dư, giá trị, data status, related recommendation count.
   - Missing price phải có badge rõ.

6. Open positions snapshot
   - Giữ phần vị thế trade đang mở nếu code đã có.
   - Không để nó lấn át action queue.

7. Indirect impact section
   - Title: `Ảnh hưởng gián tiếp tới danh mục`.
   - Copy rõ: đây là tín hiệu theo dõi, không phải hành động trực tiếp.

8. Disclaimer
   - Giữ disclaimer: NDL không phải cố vấn tài chính.

Logic bắt buộc:

- Build Today Action Queue từ `proposals.data`.
- Với mỗi proposal derive:
  - `impact = derivePortfolioImpact(...)`
  - `status = deriveRecommendationStatus(...)`
  - `isWatched = deriveIsWatched(...)`
- Actionable statuses:
  - `ACTIVE`
  - `EXPIRING_SOON`
  - `MISSING_DATA`
- Sort priority:
  - Expiring soon cao nhất.
  - Direct impact cao hơn indirect/outside.
  - SELL/high risk cao hơn.
  - Confidence cao hơn.
  - Newer createdAt nếu tie.
- Nếu `totalValueStatus === MISSING_PRICE_DATA`, không hiển thị total value như số chắc chắn.

Acceptance criteria:

- `/overview` có title đúng câu hỏi decision inbox.
- Có 4 metric cards.
- Có trust badge nhỏ.
- Có risk banner khi missing/stale/expired data.
- Today Action Queue tối đa 5 item.
- Card có token/action/confidence/risk/expiry/impact/short reason/CTA.
- Không render API path hoặc thuật ngữ backend.
- Không có CTA `Thực thi` trực tiếp trong overview card.
- Loading/no wallet/empty state vẫn hoạt động.
```

## Prompt 2: Audit/Fix `/portfolio` Holdings Risk And Related Actions

```txt
Hãy audit màn `/portfolio` trong `apps/web/app/portfolio/page.tsx` theo wireframe mới.

Quan trọng:

- Màn này có thể đã được refactor một phần hoặc gần đủ.
- Trước khi sửa, liệt kê phần đã đạt và phần còn thiếu.
- Chỉ bổ sung/chỉnh gap còn thiếu.
- Không rewrite toàn bộ layout nếu cấu trúc hiện tại đã đạt yêu cầu.

Mục tiêu UX:

Màn Danh mục phải trả lời 3 câu hỏi:

- Token nào trong ví đang có rủi ro?
- Token nào có khuyến nghị liên quan trực tiếp?
- Token nào thiếu giá hoặc dữ liệu không đủ?

Yêu cầu layout:

1. Header
   - Eyebrow: `Danh mục`.
   - Title: `Token nào trong ví cần chú ý?`.
   - Description: NDL bắt đầu từ tài sản user đang giữ, sau đó gắn khuyến nghị, rủi ro và chất lượng dữ liệu.
   - Actions:
     - `Cập nhật ví và giá`.
     - `Xem khuyến nghị liên quan`.

2. Summary metrics
   - `Tổng giá trị danh mục`.
   - `Tài sản đang nắm giữ`.
   - `Token cần chú ý`.
   - `Khuyến nghị liên quan`.

3. Data Quality Warning
   - Nếu `missingPriceCount > 0`, hiển thị warning amber.
   - Copy: tổng giá trị danh mục chỉ là ước tính nếu thiếu giá.
   - Liệt kê token thiếu giá và reason user-facing.

4. Holdings List
   - Mỗi row/card có:
     - Token.
     - Token address hoặc missing reason nhỏ.
     - Số dư.
     - Giá trị.
     - Data quality badge.
     - Tỷ trọng nếu có.
     - Số khuyến nghị liên quan.
     - Risk status:
       - `Cần kiểm tra`
       - `Có rủi ro`
       - `Có khuyến nghị`
       - `Ổn`
     - CTA `Mở` nếu có related recommendation.

5. Related Recommendations
   - Section `Khuyến nghị liên quan` cho direct impact.
   - Section `Ảnh hưởng gián tiếp` cho indirect impact.
   - Card nhỏ nên có token/action/risk/confidence/expiry/CTA.

Logic bắt buộc:

- Active recommendations = proposals chưa expired và không `VERIFIED`/`EXECUTED`.
- Với mỗi holding:
  - Direct recommendations: proposal tokenSymbol match holding symbol.
  - Indirect recommendations: proposal id nằm trong crossImpacts.proposalIds liên quan holding token.
  - Risk status:
    - holding `dataQuality === MISSING_PRICE` -> `Cần kiểm tra`.
    - any related recommendation risk HIGH/CRITICAL -> `Có rủi ro`.
    - có related recommendations -> `Có khuyến nghị`.
    - else -> `Ổn`.
- Sort holdings theo value giảm dần.
- Nếu value missing, label `Chưa đủ dữ liệu giá`.

Acceptance criteria:

- User nhìn thấy token nào thiếu giá.
- User nhìn thấy token nào có khuyến nghị trực tiếp/gián tiếp.
- Total value không được trình bày như số chắc chắn khi thiếu giá.
- Holding có active recommendation có CTA mở detail.
- Không dùng thuật ngữ `Cross-impact`; dùng `Ảnh hưởng gián tiếp`.
- Mobile layout vẫn scan được, không ép table rộng.
```

## Prompt 3: Complete `/recommendations` Recommendation Center Filters

```txt
Hãy audit và hoàn thiện `/recommendations` trong:

- `apps/web/app/recommendations/page.tsx`
- `apps/web/app/recommendations/components/RecommendationCard.tsx`

Quan trọng:

- Recommendation Center có thể đã có header, tabs, card hierarchy.
- Trước khi sửa, liệt kê phần đã đạt và phần còn thiếu.
- Trọng tâm prompt này là filter bar thật, URL search params, và các gap còn thiếu trên card.
- Không gọi API riêng cho từng tab/filter.

Mục tiêu UX:

Recommendation Center gom toàn bộ recommendations và opportunities thành một workflow chuẩn hóa. User phải phân biệt được:

- Cái gì cần xử lý ngay.
- Cái gì liên quan danh mục.
- Cái gì ngoài danh mục.
- Cái gì đã kiểm chứng.
- Cái gì hết hiệu lực.

Yêu cầu layout:

1. Header
   - Eyebrow: `Trung tâm khuyến nghị`.
   - Title: `Chọn việc cần quyết định tiếp theo`.
   - Description: Ưu tiên danh mục trước, sau đó mới đến cơ hội ngoài ví.

2. Filter bar
   Thêm filter controls thật, ưu tiên search params để hỗ trợ back/forward:
   - Token: tất cả / token symbols.
   - Hành động: tất cả / BUY / SELL / HOLD / WAIT...
   - Rủi ro: tất cả / low / medium / high / critical.
   - Độ tin cậy: tất cả / >50 / >60 / >75.
   - Thời hạn: tất cả / còn hiệu lực / sắp hết hạn / hết hiệu lực.
   - Dữ liệu: tất cả / đủ dữ liệu / thiếu dữ liệu.
   - Có `Reset filters`.

Search params:

- `tab=urgent|portfolio|outside-portfolio|verified|expired`
- `token=SOL`
- `action=BUY|SELL|HOLD|WAIT`
- `risk=LOW|MEDIUM|HIGH|CRITICAL`
- `confidence=50|60|75`
- `expiry=active|expiring|expired|all`
- `data=complete|missing|all`

Implementation requirements:

- Updating filters phải preserve `tab`.
- Derive token options từ `proposals.data`.
- Filters phải accessible và responsive.
- Empty state phải phản ánh filtered result.

3. Tabs
   Giữ đúng 5 tabs:
   - `Cần xử lý ngay` -> `?tab=urgent`.
   - `Liên quan danh mục` -> `?tab=portfolio`.
   - `Ngoài danh mục` -> `?tab=outside-portfolio`.
   - `Đã kiểm chứng` -> `?tab=verified`.
   - `Hết hiệu lực` -> `?tab=expired`.

4. Recommendation list
   - Urgent và portfolio tabs nên dùng list một cột để giữ priority order.
   - Outside portfolio có thể dùng grid nếu hợp responsive.

5. RecommendationCard
   Card phải render theo hierarchy:
   - Token.
   - Action badge.
   - Portfolio impact badge.
   - Risk badge.
   - Expiry/status badge.
   - Watched badge.
   - Confidence: `Tin cậy`.
   - Quant score: `Điểm tín hiệu` nếu data có `quantScore` hoặc `scoreComponents.finalScore`.
   - Short reason.
   - Missing data warning nếu status `MISSING_DATA`.
   - Expired note nếu status `EXPIRED`.
   - CTA chính: `Xem chi tiết`.
   - CTA phụ: `Theo dõi`, nếu chưa watched và không expired/executed.

Logic bắt buộc:

- Dùng `derivePortfolioImpact`, `deriveRecommendationStatus`, `deriveIsWatched`.
- Không gọi API riêng cho từng tab; dùng data từ `useNdlData()` rồi filter frontend.
- First derive all items.
- Apply tab filter.
- Apply filter bar.
- Sort by priority.
- Tab filter:
  - `verified`: status `VERIFIED`.
  - `expired`: status `EXPIRED`.
  - `outside-portfolio`: impact `OUTSIDE`, bỏ `EXPIRED`, `VERIFIED`, `EXECUTED`.
  - `portfolio`: impact `DIRECT` hoặc `INDIRECT`, bỏ `EXPIRED`, `VERIFIED`, `EXECUTED`.
  - `urgent`: status `ACTIVE`, `EXPIRING_SOON`, `MISSING_DATA`.
- Apply filter bar sau khi tab filter hoặc theo thứ tự hợp lý, nhưng UX phải nhất quán.
- Priority score:
  - Base confidence.
  - Expiring soon bonus.
  - Missing data bonus vừa phải.
  - Direct > indirect > outside.
  - SELL/high risk ưu tiên cao.

Acceptance criteria:

- Có filter bar hoạt động.
- URL phản ánh filter hiện tại.
- Browser back/forward hoạt động với filter.
- Reset filters hoạt động và giữ tab hiện tại.
- Có đủ 5 tabs.
- Không có tab `Đang theo dõi`.
- `Đã theo dõi` chỉ là badge.
- Expired card muted, không có trade/execute CTA.
- Missing data card có warning.
- Card có `Điểm tín hiệu` nếu proposal có quant data.
- Không dùng chữ `Proposal`, `Quant`, `Cross-impact` trong UI thường.
```

## Prompt 4: Audit/Fix `/proposal/[id]` Decision Detail Header

```txt
Hãy audit màn `/proposal/[id]` trong `apps/web/app/proposal/[id]/page.tsx` để first viewport đạt Decision Detail đúng wireframe mới.

Quan trọng:

- File hiện tại có thể đã có `DecisionHeader`.
- Không tạo header mới nếu header hiện tại có thể chỉnh được.
- Trước khi sửa, liệt kê phần đã đạt và phần còn thiếu.
- Trọng tâm gap thường gặp: `Cách tính` cạnh `Độ tin cậy`, `Cách tính` cạnh `Điểm tín hiệu`, CTA safety, và disabled reason.

Mục tiêu UX:

User vào chi tiết phải thấy ngay:

- Token nào.
- Nên làm gì.
- Có đáng tin không.
- Rủi ro ra sao.
- Còn bao lâu.
- Ảnh hưởng trực tiếp/gián tiếp tới danh mục.
- Có được chuẩn bị giao dịch không.

Yêu cầu DecisionHeader:

1. Header top
   - Back button.
   - Title user-facing: `Chi tiết khuyến nghị`.
   - Trust badge nhỏ.

2. Main decision row
   - Token symbol/name.
   - Action badge.
   - Portfolio impact badge.
   - Status badge.
   - Watched badge nếu có.
   - Countdown badge nếu chưa verified.

3. Decision stats
   - `Độ tin cậy`: formatted confidence + button/link `Cách tính`.
   - `Điểm tín hiệu`: quantScore hoặc scoreComponents.finalScore + button/link `Cách tính`.
   - `Rủi ro`.
   - `Thời hạn`.
   - `Ảnh hưởng danh mục`.
   - `Cập nhật`.

4. Trade safety warning
   - Nếu expired, warning: tín hiệu đã hết hiệu lực, không nên xem đây là cơ hội hành động mới.
   - Nếu verified/completed, warning: chỉ nên dùng để tham khảo.
   - Nếu missing data, warning: thiếu dữ liệu giá, nguồn hoặc lịch sử.

5. CTA hierarchy
   - Chỉ 1 primary CTA nổi bật.
   - Nếu actionable và đủ dữ liệu: primary `Chuẩn bị giao dịch`.
   - Nếu actionable nhưng missing data: primary `Theo dõi dữ liệu`.
   - Nếu expired/verified/executed: không có trade CTA; dùng `Xem lịch sử token`.
   - Secondary có thể là `Theo dõi dữ liệu` hoặc `Từ chối`, nhưng không làm rối first viewport.

6. Rationale section
   - Giữ section `Vì sao khuyến nghị này đáng đọc?`.
   - Summary ngắn trước, bullets sau, expand/collapse nếu dài.

7. Decision support
   - Thêm hoặc chỉnh section hỗ trợ quyết định gồm:
     - Giá hiện tại.
     - Giá vào gợi ý.
     - Mục tiêu.
     - Cắt lỗ nếu có.
     - PnL/ROI dự kiến nếu có.
     - Data quality.

Logic bắt buộc:

- `completed = hasVerificationResult(data)`.
- `expired = isExpired(data.expiresAt)`.
- `missingData = hasMissingDecisionData(data) || dataStatus includes missing`.
- `actionable = !completed && !expired`.
- `canPrepareTrade = actionable && !missingData`.
- Không route user vào `/trade` khi expired/completed/missingData.

Acceptance criteria:

- DecisionHeader nằm trước rationale/evidence/chart.
- Có confidence `Cách tính`.
- Có quant `Cách tính`.
- Có disabled reason rõ.
- Chỉ có 1 primary CTA.
- Expired/verified/missing data không có CTA trade trực tiếp.
- Không dùng thuật ngữ backend trong first viewport.
```

## Prompt 5: Add Confidence Explanation Drawer

```txt
Hãy thêm Confidence Explanation Drawer cho màn `/proposal/[id]`.

Điều kiện trước khi làm:

- Chạy Prompt 10 trước để có shared drawer hoặc xác nhận đã có component tương đương.
- Nếu đã có shared drawer, reuse nó.
- Không tạo drawer riêng biệt nếu shared component dùng được.

Mục tiêu UX:

Khi user click `Cách tính` cạnh `Độ tin cậy`, mở drawer/modal giải thích nhanh mà không rời khỏi decision flow.

Responsive behavior:

- Desktop: side drawer từ phải, rộng khoảng 420-560px.
- Mobile: bottom drawer, cao tối đa khoảng 80vh.
- Có overlay và nút đóng.
- Escape/click outside đóng nếu component library hỗ trợ.

Data source:

- Dùng `useProposalScoreExplanation(id)` đã có trong detail page.
- Fallback sang `ProposalData` nếu explanation chưa load.

Content:

Title:

- `Cách tính độ tin cậy`
- Value: formatted `confidence`.

Intro:

- `Đây là độ tin cậy của luận điểm, không phải xác suất có lời.`

Sections user-facing:

1. `Độ mạnh tín hiệu`
   - Dùng positive/negative factors hoặc score components để diễn giải.

2. `Chất lượng nguồn`
   - Dựa vào `sources`, `dataSources`, `trustChecklist`.

3. `Độ mới dữ liệu`
   - Dựa vào `createdAt`, freshness, missingData.

4. `Mức liên quan danh mục`
   - Dựa vào `portfolioImpact`.

5. `Điểm trừ dữ liệu thiếu`
   - Dựa vào `missingData`, `sampleSizePenalty`, missing source/price/confidence.

6. `Điều chỉnh kiểm chứng`
   - Nếu có `backtestedAt`, `winLossStatus`, `pnlPercentage`, giải thích đã có kết quả kiểm chứng.

Footer:

- Formula summary nếu API có `confidenceFormula`, nhưng viết user-facing.
- Link/button: `Xem audit chi tiết` tới `/proposal/:id/explanation/confidence`.

States:

- Loading: skeleton drawer.
- Error/no data: `Chưa đủ dữ liệu để giải thích độ tin cậy.`
- Missing data: hiển thị warning amber.

Do not show in normal drawer:

- `confidenceDivisor`
- `coldStartConfidenceDivisor`
- raw JSON
- API path
- pipeline terms

Acceptance criteria:

- Click `Cách tính` mở drawer.
- Drawer không làm mất DecisionHeader context.
- User hiểu confidence không phải xác suất lợi nhuận.
- Drawer có link sang route explanation chi tiết.
- Mobile không overflow hoặc che CTA khó đóng.
```

## Prompt 6: Add Signal Score Explanation Drawer

```txt
Hãy thêm Signal Score Explanation Drawer cho màn `/proposal/[id]`.

Điều kiện trước khi làm:

- Chạy Prompt 10 trước để có shared drawer hoặc xác nhận đã có component tương đương.
- Nếu đã có shared drawer, reuse nó.
- Không tạo drawer riêng biệt nếu shared component dùng được.

Mục tiêu UX:

Khi user click `Cách tính` cạnh `Điểm tín hiệu`, mở drawer/modal giải thích vì sao điểm tín hiệu cao/thấp bằng ngôn ngữ trader.

User-facing naming:

- Không dùng label chính là `Quant`.
- Dùng `Điểm tín hiệu`.

Data source:

- `ProposalData.quantScore`
- fallback `ProposalData.scoreComponents.finalScore`
- `ScoreExplanationData.finalScore`
- `ScoreExplanationData.scoreComponents`
- `ScoreExplanationData.positiveFactors`
- `ScoreExplanationData.negativeFactors`
- `ScoreExplanationData.missingData`
- `ProposalData.signalMode`
- `ProposalData.uncertaintyEntropy`
- `ProposalData.realizedVolatility`

Content:

Title:

- `Cách tính điểm tín hiệu`
- Value: formatted final score.

Intro:

- `Điểm tín hiệu cho biết dữ liệu hiện tại nổi bật thế nào so với lịch sử và bối cảnh thị trường.`

Sections:

1. `Độ lệch giá / volume bất thường`
   - Map từ `pureAlphaZ` hoặc positive factors.

2. `Bối cảnh thị trường`
   - Map từ factors/context nếu có.

3. `Yếu tố thời điểm`
   - Map từ `timeZ`.

4. `Ảnh hưởng liên quan`
   - Map từ `crossZ`.

5. `Điểm trừ nhiễu / dữ liệu thiếu`
   - Map từ `uncertaintyEntropy`, `realizedVolatility`, `missingData`.

6. `Chế độ tín hiệu`
   - Nếu `COLD_START`, copy:
     `Token còn ít lịch sử, điểm tín hiệu có thể biến động mạnh hơn bình thường.`
   - Nếu `NORMALIZED_ALPHA`, copy:
     `Token có đủ lịch sử hơn để so sánh với mẫu quá khứ.`

Footer:

- Formula summary nếu có `quantFormula`, nhưng tránh raw backend.
- Explain bands:
  - `> 2.0`: tín hiệu mạnh.
  - `1.0 - 2.0`: tín hiệu đáng chú ý.
  - `-1.0 - 1.0`: trung lập.
  - `< -1.0`: tín hiệu nghiêng bán/rủi ro.
- Link: `Xem breakdown kỹ thuật` -> `/proposal/:id/explanation/quant`.

States:

- Loading skeleton.
- Empty: `Chưa đủ dữ liệu để giải thích điểm tín hiệu.`
- Missing sample/source warning if applicable.

Acceptance criteria:

- DecisionHeader có `Điểm tín hiệu` và `Cách tính`.
- Click mở drawer.
- Drawer dùng ngôn ngữ user/trader.
- Không gọi label chính là `Quant`.
- Có fallback nếu scoreComponents thiếu.
```

## Prompt 7: Audit/Fix Backtest TOKEN Chart Section

```txt
Hãy audit phần backtest/timeline trong `/proposal/[id]` và hoàn thiện thành section `Backtest TOKEN` rõ ràng hơn.

Quan trọng:

- `ProposalAccuracyChart.tsx` có thể đã render price line, markers, summary, warnings.
- Không rebuild chart nếu chart hiện tại đã đạt phần lớn yêu cầu.
- Ưu tiên sửa title/copy/summary/warning và các gap còn thiếu.

Files cần đọc:

- `apps/web/app/proposal/[id]/page.tsx`
- `apps/web/app/proposal/[id]/ProposalAccuracyChart.tsx`
- `apps/web/lib/hooks/useNdlData.ts`

Data source:

- `useProposalTimeline(id)`
- `ProposalTimelineData.priceHistory`
- `ProposalTimelineData.currentProposal`
- `ProposalTimelineData.historicalProposals`
- `ProposalTimelineData.backtestResults`
- `ProposalTimelineData.priceCoverage`
- `ProposalTimelineData.missingData`

Yêu cầu section:

Title:

- `Backtest TOKEN: {tokenSymbol}`

Subtitle:

- `Lịch sử giá và độ đúng của các khuyến nghị tương tự.`

Chart:

- Render line chart giá token từ `priceHistory`.
- Highlight current proposal marker.
- Render historical proposal markers.
- Marker color/icon theo:
  - BUY.
  - SELL.
  - HOLD.
  - Win.
  - Loss.
  - Pending.
  - Breakeven.
- Nếu marker `priceStatus` không phải `MATCHED`, marker phải có limited/muted state.

Summary cards/table:

- `Số khuyến nghị tương tự`: count historical proposals hoặc backtest results.
- `Win-rate`: derive từ backtestResults result Win / resolved results.
- `ROI trung bình`: average pnlPercentage nếu có.
- `Dữ liệu giá`: pointCount hoặc coverage label.
- Optional `Max drawdown` chỉ hiển thị nếu có data đáng tin.

Warnings:

- Nếu `missingData.length > 0`, hiển thị warning.
- Nếu `priceCoverage.pointCount` thấp hoặc không có price history, hiển thị empty/limited state.
- Copy bắt buộc:
  `Backtest là dữ liệu tham khảo, không đảm bảo kết quả tương lai.`

Acceptance criteria:

- Section không còn chung chung là chỉ `Lịch sử kiểm chứng`; phải nêu rõ token.
- Chart có price line và markers.
- Có summary backtest.
- Có data quality warning.
- Missing timeline không crash page.
- Không trình bày backtest như cam kết lợi nhuận.
```

## Prompt 8: Audit Trade Safety In Scenario And Trade Flow

```txt
Hãy kiểm tra và refactor trade safety cho:

- `apps/web/app/proposal/[id]/scenario/page.tsx`
- `apps/web/app/proposal/[id]/trade/page.tsx`
- logic liên quan trong `/proposal/[id]`

Quan trọng:

- Trước tiên kiểm tra các route file trên có tồn tại không.
- Nếu route scenario/trade không tồn tại, không tự tạo route mới.
- Nếu route không tồn tại, chỉ audit/chỉnh logic liên quan trong `/proposal/[id]` và báo rõ route nào không tồn tại.

Mục tiêu:

Expired, verified, executed, hoặc missing data recommendation không được route user vào trade flow mới như một cơ hội còn hiệu lực.

Logic bắt buộc:

- Dùng hoặc mirror helper:
  - `deriveRecommendationStatus`
  - `hasMissingDecisionData`
  - `hasVerificationResult`
  - `isExpired`

Scenario page:

- Nếu active và đủ dữ liệu: nút `Dùng kịch bản này`.
- Nếu expired: disabled, label `Đã hết hiệu lực`.
- Nếu missing data: disabled, label `Thiếu dữ liệu để vào lệnh`.
- Nếu verified/executed: disabled hoặc route sang history, không trade mới.

Trade page:

- Disable `Xác nhận vào lệnh` nếu:
  - expired.
  - verified/completed.
  - missing price/source/confidence.
  - risk preview chưa load.
  - risk preview error.
- Nếu risk preview limited nhưng vẫn allowed, cần confirmation trước khi execute.

Copy:

- Expired: `Khuyến nghị đã hết hiệu lực và chỉ còn giá trị tham khảo.`
- Missing data: `Thiếu dữ liệu giá, nguồn hoặc độ tin cậy. Hãy theo dõi thêm trước khi giao dịch.`
- Verified: `Khuyến nghị đã có kết quả kiểm chứng, không còn là cơ hội hành động mới.`

Acceptance criteria:

- Không có đường nào từ expired card/detail/scenario vào confirm trade.
- Missing data không được confirm trade.
- User luôn thấy lý do disabled.
- Không dùng CTA `Thực thi` nếu chưa qua trade preview.
```

## Prompt 9: Deprecated - Merged Into Prompt 3

```txt
Không chạy prompt này riêng.

Nội dung filter state/search params đã được gộp vào Prompt 3 để tránh tạo hai cơ chế filter khác nhau trong `/recommendations`.
```

## Prompt 10: Add Shared Explanation Drawer Component

```txt
Hãy tạo hoặc refactor một shared explanation drawer component để dùng cho Confidence và Điểm tín hiệu.

Quan trọng:

- Chạy prompt này trước Prompt 5 và Prompt 6.
- Trước khi tạo component mới, kiểm tra `apps/web/app/components/shared/NdlUi.tsx` và các component gần `/proposal/[id]` xem đã có drawer/modal reusable chưa.
- Nếu đã có component phù hợp, refactor nhẹ để dùng lại thay vì tạo component song song.

Suggested location:

- `apps/web/app/components/shared/NdlUi.tsx`
- hoặc component riêng gần proposal detail nếu scope hẹp hơn.

Component API proposal:

type ExplanationDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  value?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

Design:

- Desktop: fixed right panel.
- Mobile: fixed bottom sheet.
- Overlay.
- Close button with accessible label.
- Max height with internal scroll.
- Does not break page scroll when open.

Use cases:

- Confidence explanation.
- Signal score explanation.
- Later: source quality explanation.

Acceptance criteria:

- Keyboard accessible close.
- Responsive desktop/mobile.
- No layout shift in DecisionHeader.
- Reusable by both explanation drawers.
```

## Prompt 11: Copy And Terminology Cleanup

```txt
Hãy scan và cleanup user-facing copy trong các màn.

Quan trọng:

- Đây là prompt cleanup sau cùng, không phải prompt refactor layout.
- Trước khi sửa, liệt kê các copy vi phạm tìm được theo file.
- Chỉ sửa user-facing copy vi phạm.
- Không đổi tên biến/type/API/backend field chỉ vì chúng chứa `Proposal`, `Quant`, hoặc thuật ngữ nội bộ.
- Không sửa copy trong Advanced/Debug/Explanation nếu thuật ngữ kỹ thuật có diễn giải rõ và không lộ ở UI thường.

Các màn cần scan:

- `/overview`
- `/portfolio`
- `/recommendations`
- `/proposal/[id]`
- explanation/drawer components liên quan

Replace:

- `Proposal` -> `Khuyến nghị` hoặc `Luận điểm`.
- `Quant` -> `Điểm tín hiệu`.
- `Cross-impact` -> `Ảnh hưởng gián tiếp`.
- `Diagnostics` -> `Kiểm tra rủi ro`.
- `Model Health` -> `Độ tin cậy hệ thống`.
- `Backtest` -> `Kết quả kiểm chứng` hoặc `Backtest TOKEN` nếu là chart chuyên biệt.

Do not show in normal UI:

- API path.
- raw JSON.
- active config.
- confidenceDivisor.
- coldStartDivisor.
- pipeline score.
- Layer 2 / Layer 3 wording, unless in Advanced explanation and có diễn giải user-facing.

Acceptance criteria:

- Không còn "Proposal" ở nav/card/title/CTA user-facing.
- Không còn API path trong UI text thường.
- Technical copy chỉ ở Advanced/Debug/Explanation.
- Confidence không bị diễn giải là xác suất có lời.
```

## Prompt 12: Final QA Prompt

```txt
Hãy QA toàn bộ refactor UI theo checklist sau.

Trước khi test:

- Chạy dev server nếu cần để kiểm tra bằng browser.
- Lấy một proposal id thật từ data/API hoặc từ link trong `/recommendations`; không test literal `/proposal/:id`.
- Kiểm tra route file tồn tại trước khi test `/proposal/:id/scenario` và `/proposal/:id/trade`.
- Nếu scenario/trade route không tồn tại, ghi rõ là route không tồn tại và chỉ QA các đường link/CTA không route sai vào đó.

Routes cần test:

- `/overview`
- `/portfolio`
- `/recommendations?tab=urgent`
- `/recommendations?tab=portfolio`
- `/recommendations?tab=outside-portfolio`
- `/recommendations?tab=verified`
- `/recommendations?tab=expired`
- `/proposal/:id`
- `/proposal/:id/scenario`
- `/proposal/:id/trade`

Checklist:

Navigation:

- Chỉ có 5 nav chính: Tổng quan, Danh mục, Khuyến nghị, Theo dõi, Vị thế.
- Không có Alerts/Diagnostics/Model Health/Opportunities ở nav chính.

Overview:

- Có 4 metrics.
- Có TrustBadge.
- Có RiskBanner khi cần.
- Today Action Queue max 5.
- Không có CTA `Thực thi` trực tiếp.

Portfolio:

- Missing price rõ.
- Total value không chắc chắn khi thiếu giá.
- Holding có related action mở được detail.

Recommendations:

- Có filter bar.
- Có 5 tabs.
- Không có tab Đang theo dõi.
- Expired muted.
- Missing data warning.
- Card có confidence và quant nếu có data.

Proposal Detail:

- DecisionHeader first viewport.
- Có `Cách tính` cho confidence.
- Có `Cách tính` cho điểm tín hiệu.
- Drawer mở/đóng đúng.
- Backtest TOKEN chart có line/markers/summary/warning.
- Chỉ 1 primary CTA.
- Expired/missing/verified không vào trade trực tiếp.

Build:

- Chạy typecheck/build.
- Fix lỗi TypeScript/lint/build nếu có.

Visual:

- Mobile không overflow.
- Button text không vỡ layout.
- Drawer không che mất nút đóng.
- Không có card lồng card quá mức.

Output mong muốn:

- Tóm tắt route nào pass/fail.
- Nêu lỗi còn lại theo file/line nếu có.
- Nêu command build/typecheck đã chạy và kết quả.
- Nếu không test được route nào vì thiếu dữ liệu hoặc route không tồn tại, ghi rõ lý do.
```
