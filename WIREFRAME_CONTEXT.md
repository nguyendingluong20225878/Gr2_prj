# NDL Wireframe Context

File này tổng hợp những phần cần biết trong code để vẽ và triển khai các wireframe mới cho NDL: Today Decision Inbox, Portfolio, Recommendation Center, Recommendation Detail, Confidence/Quant explanation drawer, và backtest chart theo token.

Mục tiêu của file: giúp designer/frontend đọc một lần là hiểu dữ liệu nào có sẵn, logic nào đang derive ở frontend, màn nào đang render gì, và những phần code đã có nhưng wireframe trước chưa đưa lên.

## 1. Product Framing

NDL không phải dashboard signal nội bộ. NDL là personal crypto decision assistant.

Các nguyên tắc phải giữ khi vẽ wireframe:

- Portfolio-first, signal-second: bắt đầu từ token user đang giữ.
- Decision before explanation: kết luận/action/risk lên trước, công thức và bằng chứng ở lớp sau.
- User language before system language: dùng "Khuyến nghị", "Độ tin cậy", "Điểm tín hiệu", "Ảnh hưởng gián tiếp"; tránh "Proposal", "Quant", "Pipeline", "API path" trong UI thường.
- Technical data only in Advanced/Debug: công thức raw, score components, audit trail chỉ ở drawer explanation, route explanation, Advanced hoặc Trust Center.
- Expired hoặc missing data không được trình bày như cơ hội hành động mới.

## 2. Main Routes And Current Code

| Route | File chính | Vai trò UX |
| --- | --- | --- |
| `/overview` | `apps/web/app/overview/page.tsx` | Today Decision Inbox: user biết hôm nay cần xử lý gì trong 5 giây đầu |
| `/portfolio` | `apps/web/app/portfolio/page.tsx` | Danh mục + rủi ro + data quality + related recommendations |
| `/recommendations` | `apps/web/app/recommendations/page.tsx` | Trung tâm khuyến nghị, gom cả opportunities |
| `/proposal/[id]` | `apps/web/app/proposal/[id]/page.tsx` | Chi tiết khuyến nghị, Decision Header, rationale, backtest/timeline, Advanced |
| `/proposal/[id]/explanation` | `apps/web/app/proposal/[id]/explanation/page.tsx` | Explanation tổng hợp |
| `/proposal/[id]/explanation/confidence` | `apps/web/app/proposal/[id]/explanation/confidence/page.tsx` | Cách tính độ tin cậy |
| `/proposal/[id]/explanation/quant` | `apps/web/app/proposal/[id]/explanation/quant/page.tsx` | Cách tính điểm tín hiệu |
| `/proposal/[id]/scenario` | `apps/web/app/proposal/[id]/scenario/page.tsx` | Kịch bản trước trade |
| `/proposal/[id]/trade` | `apps/web/app/proposal/[id]/trade/page.tsx` | Trade flow, phải disable khi expired/missing data |
| `/watchlist` | `apps/web/app/watchlist/page.tsx` | Khuyến nghị user đang theo dõi |
| `/positions` | `apps/web/app/positions/page.tsx` | Vị thế/giao dịch đã thực hiện |
| `/model-health` | `apps/web/app/model-health/page.tsx` | Trust/Advanced, không nằm nav chính |
| `/data-check` | `apps/web/app/data-check/page.tsx` | Kiểm tra dữ liệu/Advanced |

Nav chính hiện chỉ có 5 mục trong `apps/web/app/components/layout/navigationItems.ts`:

1. Tổng quan -> `/overview`
2. Danh mục -> `/portfolio`
3. Khuyến nghị -> `/recommendations`
4. Theo dõi -> `/watchlist`
5. Vị thế -> `/positions`

Không đưa `/alerts`, `/diagnostics`, `/model-health`, `/opportunities` vào nav chính.

## 3. Shared Data Hook

Data chính được lấy từ `apps/web/lib/hooks/useNdlData.ts`.

`useNdlData()` trả về:

| Key | API | Refresh | Dùng cho |
| --- | --- | --- | --- |
| `portfolio` | `/api/portfolio` | 60s | holdings, investments, stats |
| `proposals` | `/api/proposals` | 30s | danh sách khuyến nghị |
| `signals` | `/api/signals?limit=100&type=ALL&meta=1` | 30s | signal/raw explanation phụ |
| `modelHealth` | `/api/model-health` | focus/60s dedupe | trust badge, system health |
| `watchlist` | `/api/watchlist` | 30s | trạng thái Đã theo dõi |
| `crossImpacts` | `/api/portfolio/cross-impacts` | 60s | ảnh hưởng gián tiếp |
| `walletAddress` | Solana wallet adapter | realtime | trạng thái đã kết nối ví |

Detail hooks:

| Hook | API | Dùng cho wireframe |
| --- | --- | --- |
| `useProposalDetail(id)` | `/api/proposals/:id` | Decision Header, rationale, trade safety |
| `useProposalScoreExplanation(id)` | `/api/proposals/:id/score-explanation` | Confidence drawer, Quant drawer, audit trail |
| `useProposalTimeline(id)` | `/api/proposals/:id/timeline` | Backtest TOKEN chart, markers, price history |
| `useSignalDetail(id)` | `/api/signals/:id` | Signal explanation route |

## 4. Core Types For Wireframes

### Holding

Source: `useNdlData.ts`.

Fields quan trọng:

- `symbol`: token label.
- `tokenAddress`: dùng làm fallback/technical label.
- `balance`: số dư token.
- `price`: giá hiện tại nếu có.
- `value`: giá trị USD nếu có.
- `dataQuality`: thường là `OK` hoặc `MISSING_PRICE`.
- `missingReason`: ví dụ `NO_TOKEN_MAPPING`, `NO_PRICE`.

Wireframe cần thể hiện:

- Token.
- Số dư.
- Giá trị.
- Dữ liệu: đủ dữ liệu / thiếu giá.
- Rủi ro.
- Số khuyến nghị liên quan.
- CTA mở khuyến nghị nếu có.

### PortfolioData

Fields:

- `holdings`: danh sách tài sản.
- `investments`: vị thế/giao dịch đã thực hiện.
- `watchlist`: danh sách theo dõi ở portfolio response.
- `stats.totalValue`: tổng giá trị.
- `stats.missingPriceCount`: số token thiếu giá.
- `stats.totalValueStatus`: `COMPLETE`, `PARTIAL`, `MISSING_PRICE_DATA`.

Logic UX:

- Nếu `totalValueStatus === MISSING_PRICE_DATA`, không hiển thị tổng tài sản như số chắc chắn.
- Copy nên là "Chưa đủ dữ liệu giá" hoặc "Tổng giá trị chỉ là ước tính".

### ProposalData

Fields quan trọng cho Recommendation Card và Detail:

- `_id`: route `/proposal/:id`.
- `tokenSymbol`, `tokenName`, `tokenAddress`: token identity.
- `action` hoặc fallback `suggestionType`: BUY/SELL/HOLD/etc.
- `title`, `summary`, `rationaleSummary`, `reason`: lý do ngắn/dài.
- `sources`: nguồn dữ liệu.
- `confidence`: độ tin cậy.
- `quantScore`: điểm tín hiệu.
- `financialImpact.currentPrice`, `currentValue`: giá hiện tại.
- `financialImpact.projectedPnL`, `targetPrice`, `projectedValue`, `roi`: expected outcome.
- `financialImpact.riskLevel`: risk level.
- `entryPrice`, `exitPrice`, `actualPnL`, `pnlPercentage`: giá vào/ra và kết quả.
- `winLossStatus`, `backtestedAt`, `backtestMeta`: backtest/verification.
- `scoreComponents`: `unifiedRaw`, `timeZ`, `pureAlphaZ`, `crossZ`, `finalScore`.
- `signalContext`: signal Layer 2 liên quan.
- `signalMode`: `COLD_START`, `NORMALIZED_ALPHA`.
- `uncertaintyEntropy`, `realizedVolatility`: nhiễu/biến động.
- `executionStatus`, `lifecycleStatus`, `status`: trạng thái thực thi/lifecycle.
- `expiresAt`, `createdAt`: thời hạn và freshness.

Wireframe card nên có:

- Token.
- Action.
- Portfolio impact.
- Risk.
- Expiry/status.
- Confidence.
- Quant/Điểm tín hiệu nếu cần tăng trust.
- Short reason.
- CTA `Xem chi tiết`, secondary `Theo dõi`.

Không nên đưa API path hoặc raw field name vào UI thường.

### ScoreExplanationData

Dùng cho drawer/modal "Cách tính độ tin cậy" và "Cách tính điểm tín hiệu".

Fields:

- `confidenceFormula`: công thức confidence dạng backend/explanation.
- `quantFormula`: công thức quant.
- `quantFormulaMode`: mode tính quant.
- `alphaBlendDefault`, `alphaBlendSource`: alpha blend nếu có.
- `signalMode`: cold start / normalized alpha.
- `sampleSize`: cỡ mẫu dữ liệu.
- `thresholds`: gồm `actionThreshold`, `alphaBlend`, `coldStartActionThreshold`, `confidenceDivisor`, `coldStartConfidenceDivisor`, `signalThreshold`.
- `scoreComponents`: raw score components.
- `finalScore`: điểm tín hiệu cuối.
- `confidence`: độ tin cậy cuối.
- `confidenceCap`: cap confidence.
- `sampleSizePenalty`: penalty do mẫu ít.
- `positiveFactors`, `negativeFactors`: yếu tố tích cực/tiêu cực để diễn giải user-facing.
- `missingData`: dữ liệu còn thiếu.
- `dataSources`: source status `OK`, `MISSING`, `LIMITED`.
- `componentDescriptions`: mô tả component.
- `trustChecklist`: checklist tin cậy.
- `cautionChecklist`: cảnh báo cần thận trọng.
- `auditTrail`: log từng bước, chỉ nên dùng trong Advanced/audit detail.

UX copy:

- Confidence = "Độ tin cậy của luận điểm", không phải xác suất có lời.
- Quant = "Điểm tín hiệu", không phải "Quant" ở UI thường.
- Tránh hiển thị `confidenceDivisor`, `coldStartDivisor`, `pipeline score` ở UI thường. Nếu cần, để trong Advanced.

### ProposalTimelineData

Dùng để vẽ biểu đồ backtest TOKEN.

Fields:

- `token.symbol`, `token.address`: token của chart.
- `priceCoverage.startAt`, `endAt`, `pointCount`, `medianGapMs`: coverage dữ liệu giá.
- `priceHistory[]`: `{ timestamp, price, source }`, dùng vẽ line chart.
- `currentProposal`: marker khuyến nghị hiện tại.
- `historicalProposals[]`: marker khuyến nghị tương tự trong quá khứ.
- `backtestResults[]`: kết quả win/loss/pending/breakeven.
- `missingData[]`: thiếu price history, marker match, etc.

`ProposalTimelineMarker`:

- `id`.
- `date`.
- `action`: BUY/SELL/HOLD.
- `confidence`.
- `quant`.
- `result`: Win/Loss/Pending/Breakeven.
- `pnlPercentage`.
- `entryPrice`, `exitPrice`.
- `expirationTime`.
- `isCurrent`.
- `priceStatus`: `MATCHED`, `OUT_OF_RANGE`, `PRICE_GAP_TOO_LARGE`, `NO_PRICE_HISTORY`.
- `markerPrice`, `matchedPriceAt`, `priceGapMs`.

Wireframe chart cần có:

- Line price history.
- Marker current proposal.
- Marker historical proposals.
- Badge result: Win/Loss/Pending/Breakeven.
- Bảng summary: số khuyến nghị tương tự, win-rate, ROI trung bình, max drawdown nếu có thể derive.
- Warning nếu `missingData.length > 0` hoặc `priceCoverage.pointCount` thấp.

## 5. Frontend Derivation Logic

File chính: `apps/web/lib/utils/recommendationDerivation.ts`.

### normalizeTokenSymbol

Logic:

- Trim + uppercase token symbol.
- Nếu empty hoặc `TOKEN CHƯA ĐỊNH DANH`, trả `null`.

Dùng để match token giữa proposal và holdings.

### hasVerificationResult

Proposal được xem là đã kiểm chứng nếu có ít nhất một trong các field:

- `backtestedAt`
- `winLossStatus`
- `pnlPercentage !== null && pnlPercentage !== undefined`

UX:

- Nếu verified, không trình bày như cơ hội hành động mới.
- Card nên muted hoặc nằm tab `Đã kiểm chứng`.

### hasMissingDecisionData

Missing decision data nếu thiếu một trong các nhóm:

- Giá: thiếu `financialImpact.currentPrice` và `financialImpact.currentValue`.
- Nguồn: thiếu `sources` và `signalContext.sources`.
- Confidence: `confidence` null/undefined.

UX:

- Hiển thị warning "Thiếu dữ liệu giá, nguồn hoặc độ tin cậy".
- Không cho execute/trade thẳng.
- CTA nên giảm cấp thành `Theo dõi dữ liệu` hoặc `Xem chi tiết`.

### deriveRecommendationStatus

Order rất quan trọng:

1. Nếu `status` hoặc `executionStatus` là `executed` / `execution_confirmed` -> `EXECUTED`.
2. Nếu `hasVerificationResult(proposal)` -> `VERIFIED`.
3. Nếu `isExpired(expiresAt)` -> `EXPIRED`.
4. Nếu `hasMissingDecisionData(proposal)` -> `MISSING_DATA`.
5. Nếu `isExpiringSoon(expiresAt, 6h)` -> `EXPIRING_SOON`.
6. Còn lại -> `ACTIVE`.

UX mapping:

| Status | Label | UI rule |
| --- | --- | --- |
| `ACTIVE` | Còn hiệu lực | Có thể xem như action candidate |
| `EXPIRING_SOON` | Sắp hết hạn | Amber badge, ưu tiên cao |
| `EXPIRED` | Hết hiệu lực | Muted, không execute |
| `VERIFIED` | Đã kiểm chứng | Học lại/tham khảo |
| `EXECUTED` | Đã thực hiện | Không là action mới |
| `MISSING_DATA` | Thiếu dữ liệu | Warning, không trade thẳng |

### derivePortfolioImpact

Input:

- `proposal`
- `holdings`
- `crossImpacts`

Rules:

1. Nếu chưa có `holdings` -> `UNKNOWN`.
2. Nếu `proposal.tokenSymbol` nằm trong symbol holdings -> `DIRECT`.
3. Nếu chưa có `crossImpacts` -> `UNKNOWN`.
4. Nếu `crossImpacts` có `proposalIds` chứa proposal id -> `INDIRECT`.
5. Còn lại -> `OUTSIDE`.

UX mapping:

| Impact | Label | UI priority |
| --- | --- | --- |
| `DIRECT` | Ảnh hưởng trực tiếp | Nổi bật nhất, scan nhanh |
| `INDIRECT` | Ảnh hưởng gián tiếp | Nổi vừa, cần giải thích |
| `OUTSIDE` | Ngoài danh mục | Không được lấn át portfolio |
| `UNKNOWN` | Chưa xác định | Loading/limited state |

### deriveIsWatched

Watched nếu `watchlist` có item:

- `item.proposalId === proposal._id`
- hoặc `item.proposal?._id === proposal._id`

UX:

- Nếu watched, hiện badge `Đã theo dõi`.
- Nếu chưa watched và card còn action được, hiện CTA phụ `Theo dõi`.

## 6. Overview Current Logic

File: `apps/web/app/overview/page.tsx`.

### Data used

- `walletAddress`
- `portfolio.data`
- `proposals.data`
- `modelHealth.data`
- `crossImpacts.data`
- `watchlist.data`

### Metrics

Hiện code render 4 metric cards:

1. Tổng giá trị danh mục.
2. Việc cần xử lý hôm nay.
3. Rủi ro cần chú ý.
4. Tín hiệu sắp hết hạn.

Logic total value:

- Nếu `totalValueStatus === MISSING_PRICE_DATA`, label là `Chưa đủ dữ liệu giá`.
- Nếu có `missingPriceCount`, hint là `Đã bỏ qua X token thiếu giá`.

### Today Action Queue

Build từ proposals:

```txt
 proposal
 impact = derivePortfolioImpact(...)
 status = deriveRecommendationStatus(...)
 isWatched = deriveIsWatched(...)
```

Actionable items:

- `ACTIVE`
- `EXPIRING_SOON`
- `MISSING_DATA`

Sort priority:

- Base score = `confidence`.
- `EXPIRING_SOON`: +120.
- `DIRECT`: +90.
- `INDIRECT`: +35.
- Action `SELL` hoặc risk `HIGH`/`CRITICAL`: +45.
- `MISSING_DATA`: +20.
- Tie-breaker: newest `createdAt`.

Limit:

- Hiển thị tối đa 5 item.
- Nếu nhiều hơn 5, CTA `Xem tất cả khuyến nghị`.

### Risk Issue Count

Tính từ:

- `missingPriceCount`.
- số proposal `MISSING_DATA`.
- số proposal `EXPIRED` mà chưa verified.
- stale data nếu latest data age > 1h.

Risk banner hiện title:

- `Dữ liệu cần kiểm tra trước khi hành động`.

Warnings có thể gồm:

- Dữ liệu stale.
- Token thiếu giá.
- Missing decision data.
- Expired unverified signals.

### Existing But Wireframe Cũ Chưa Đưa Lên

- Vị thế trade đang mở (`activeOpenInvestments`) ở Overview.
- Disclaimer: NDL không phải cố vấn tài chính.
- Stale data logic dựa trên latest proposal/modelHealth updated time.
- Trust badge link sang `/model-health`.
- Empty state khi chưa kết nối ví.
- Skeleton loading.

## 7. Portfolio Current Logic

File: `apps/web/app/portfolio/page.tsx`.

### Data used

- `portfolio.data.holdings`
- `portfolio.data.stats`
- `proposals.data`
- `crossImpacts.data`
- Solana wallet/connection để sync balances.

### Active Recommendations

```txt
 activeRecommendations =
   proposals not expired
   and status not VERIFIED
   and status not EXECUTED
```

### Holding Insight

Mỗi holding derive:

- `directRecommendations`: proposals có `proposal.tokenSymbol === holding.symbol`.
- `indirectRecommendations`: proposals có id trong `crossImpacts.proposalIds` mà impact holding token.
- `riskStatus`:
  - Nếu `holding.dataQuality === MISSING_PRICE` -> `Cần kiểm tra`.
  - Nếu any related recommendation risk `HIGH`/`CRITICAL` -> `Có rủi ro`.
  - Nếu có direct/indirect recommendations -> `Có khuyến nghị`.
  - Còn lại -> `Ổn`.

Portfolio row hiện có:

- Token.
- Số dư.
- Giá trị.
- Data quality badge.
- Allocation/tỷ trọng.
- Related recommendation count.
- Risk badge.
- CTA `Mở` tới first related recommendation.

### Existing But Wireframe Cũ Chưa Đưa Lên

- Button `Cập nhật ví và giá` sync SOL + SPL token accounts qua wallet connection.
- Button `Xem khuyến nghị liên quan`.
- Metric `Token cần chú ý`.
- Data quality warning cụ thể theo `missingReason`.
- Related recommendations section tách direct và indirect.

## 8. Recommendation Center Current Logic

Files:

- `apps/web/app/recommendations/page.tsx`
- `apps/web/app/recommendations/components/RecommendationCard.tsx`

### Tabs

Tabs hiện có:

- `urgent` -> Cần xử lý ngay.
- `portfolio` -> Liên quan danh mục.
- `outside-portfolio` -> Ngoài danh mục.
- `verified` -> Đã kiểm chứng.
- `expired` -> Hết hiệu lực.

Normalize:

- Nếu search param không hợp lệ, fallback `urgent`.

### Items

Mỗi item:

- `proposal`
- `impact = derivePortfolioImpact(...)`
- `status = deriveRecommendationStatus(...)`
- `isWatched = deriveIsWatched(...)`
- `priorityScore = computePriorityScore(...)`

Priority score:

- Base `confidence`.
- `EXPIRING_SOON`: +120.
- `MISSING_DATA`: +35.
- `DIRECT`: +90.
- `INDIRECT`: +45.
- `OUTSIDE`: +5.
- Action `SELL`: +45.
- Risk `HIGH`/`CRITICAL`: +35.
- Has verification result: +10.

Tab filter:

- `verified`: status `VERIFIED`.
- `expired`: status `EXPIRED`.
- `outside-portfolio`: impact `OUTSIDE`, bỏ `EXPIRED`, `VERIFIED`, `EXECUTED`.
- `portfolio`: impact `DIRECT` hoặc `INDIRECT`, bỏ `EXPIRED`, `VERIFIED`, `EXECUTED`.
- `urgent`: status `ACTIVE`, `EXPIRING_SOON`, `MISSING_DATA`, limit 20.

### RecommendationCard Current UI

Card hiện có:

- Token.
- Badge action.
- Badge portfolio impact.
- Badge risk.
- Badge status.
- Countdown badge nếu không verified.
- Badge `Đã theo dõi`.
- Summary.
- Warning nếu `MISSING_DATA`.
- Note nếu `EXPIRED`.
- CTA chính `Xem chi tiết`.
- CTA phụ `Theo dõi` nếu chưa watched và không expired/executed.
- Mini stats:
  - Tin cậy.
  - Giá vào.
  - Giá hiện tại.
  - PnL/ROI.
  - Ưu tiên.

### Missing In Current Wireframe/Implementation

Wireframe nên có, implementation hiện chưa có đầy đủ:

- Filter controls thật: Token, Action, Risk, Confidence, Expiry, Data quality.
- Quick `Cách tính` link ngay trên card nếu muốn tăng trust.
- `Điểm tín hiệu` mini stat trên recommendation card. Hiện card chưa nhận/render `quantScore`.
- Better desktop layout: urgent/portfolio nên là list, outside portfolio có thể grid.

## 9. Proposal Detail Current Logic

File: `apps/web/app/proposal/[id]/page.tsx`.

### Data used

- `useProposalDetail(id)`
- `useProposalTimeline(id)`
- `useProposalScoreExplanation(id)`
- `useNdlData()` for portfolio/crossImpacts/watchlist/modelHealth.

### DecisionHeader

Render first viewport:

- Title `Chi tiết khuyến nghị`.
- Trust badge from model health.
- Token name/symbol.
- Action badge.
- Portfolio impact badge.
- Status badge.
- Watched badge.
- Countdown.
- Mini stats:
  - Tin cậy.
  - Rủi ro.
  - Thời hạn.
  - Ảnh hưởng danh mục.
- Updated time.
- Disabled reason/warning.
- Data status badges.
- Primary CTA.

### Trade Safety Logic

Computed:

- `completed = hasVerificationResult(data)`.
- `expired = isExpired(data.expiresAt)`.
- `missingData = hasMissingDecisionData(data) || dataStatus includes missing/price text`.
- `actionable = !completed && !expired`.
- `canPrepareTrade = actionable && !missingData`.

Disabled reason:

- Expired -> "Tín hiệu đã hết hiệu lực. Không nên xem đây là cơ hội hành động mới."
- Completed -> "Khuyến nghị đã có kết quả kiểm chứng, chỉ nên dùng để tham khảo."
- Missing data -> "Thiếu dữ liệu giá, nguồn hoặc lịch sử. Hãy kiểm tra trước khi giao dịch."

CTA:

- Nếu actionable và canPrepareTrade -> `Chuẩn bị giao dịch` to `/proposal/:id/trade`.
- Nếu actionable nhưng missing data -> `Theo dõi dữ liệu`.
- Nếu not actionable -> `Xem lịch sử token`.

### Rationale

Section `Vì sao khuyến nghị này đáng đọc?`

Uses:

- `summary`
- `rationaleSummary`
- `reason[]`

Has expand/collapse.

### Backtest/Timeline

Section current:

- Title `Lịch sử kiểm chứng`.
- Subtitle `Lịch sử giá và độ đúng của khuyến nghị`.
- Component `ProposalAccuracyChart`.
- Data from `useProposalTimeline(id)`.

Wireframe should explicitly show:

- TOKEN name in chart title: `Backtest TOKEN: SOL`.
- Price line from `priceHistory`.
- Current proposal marker.
- Historical markers.
- Result labels.
- Missing data warning.
- Backtest summary table if derived.

### Advanced Section

Hidden by default behind `Xem chi tiết nâng cao`.

Contains:

- `ConfidenceCard`.
- `SignalScoreCard`.
- `WhyScoreSection`.
- `KeyInformation`.
- `DataSources`.

This means code already has confidence/quant explanation links, but not as first-viewport drawer.

## 10. Confidence Logic For Wireframe

Current code has `ConfidenceCard`.

Display:

- Title: `Tin cậy`.
- Value: `data.confidence%` hoặc `Chưa có dữ liệu`.
- Level:
  - `>= 75`: `Mạnh`.
  - `>= 55`: `Khá mạnh`.
  - `>= 35`: `Hạn chế`.
  - else: `Yếu hoặc bị cap`.
- CTA: `Xem cách tính độ tin cậy`.
- Link: `/proposal/:id/explanation/confidence`.

Current body:

- If `signalMode === COLD_START`: confidence bị cap tối đa 40% vì thiếu lịch sử.
- Else: confidence sau cap 95% và penalty theo sample size nếu dữ liệu ít.

Recommended wireframe:

- Trong DecisionHeader, thêm inline button `Cách tính` cạnh `Độ tin cậy`.
- Click mở side drawer desktop / bottom drawer mobile.
- Drawer dùng user-facing factors:
  - Độ mạnh tín hiệu.
  - Chất lượng nguồn.
  - Độ mới dữ liệu.
  - Mức liên quan danh mục.
  - Điểm trừ dữ liệu thiếu.
  - Điều chỉnh kiểm chứng nếu có.
- Link cuối drawer: `Xem audit chi tiết` -> `/proposal/:id/explanation/confidence`.

Do not say:

- "Độ tin cậy 88% nghĩa là xác suất có lời 88%."

Say:

- "Đây là độ tin cậy của luận điểm, không phải xác suất có lời."

## 11. Quant / Điểm Tín Hiệu Logic For Wireframe

Current code has `SignalScoreCard`.

Display:

- Title: `Điểm tín hiệu`.
- Value: `quantScore ?? scoreComponents.finalScore`.
- Direction:
  - `quant > 0`: `Nghiêng mua`.
  - `quant < 0`: `Nghiêng bán`.
  - `quant === 0`: `Trung lập`.
  - null: `Chưa đủ dữ liệu`.
- Body: điểm tín hiệu đo mức nổi bật của dữ liệu so với lịch sử và bối cảnh thị trường.
- Link: `/proposal/:id/explanation/quant`.

Relevant score components:

- `finalScore`: điểm cuối.
- `pureAlphaZ`: độ lệch bất thường.
- `crossZ`: ảnh hưởng liên quan.
- `timeZ`: yếu tố thời điểm.
- `unifiedRaw`: raw combined score.
- `realizedVolatility`: biến động.
- `uncertaintyEntropy`: độ nhiễu.
- `sampleSize`: từ explanation hoặc signal metadata.

Recommended drawer:

- Title: `Cách tính điểm tín hiệu`.
- Explain: "Điểm tín hiệu cho biết dữ liệu hiện tại nổi bật thế nào so với lịch sử và bối cảnh thị trường."
- Show components:
  - Độ lệch giá/volume bất thường.
  - Bối cảnh thị trường.
  - Yếu tố thời điểm.
  - Ảnh hưởng liên quan.
  - Điểm trừ nhiễu/dữ liệu thiếu.
- Show formula summary if available.
- Link `Xem breakdown kỹ thuật` -> `/proposal/:id/explanation/quant`.

## 12. Backtest TOKEN Chart Context

Current chart component:

- `apps/web/app/proposal/[id]/ProposalAccuracyChart.tsx`

Data source:

- `useProposalTimeline(id)`
- API `/api/proposals/:id/timeline`

Chart should use:

- `priceHistory` for price line.
- `currentProposal` marker for current decision.
- `historicalProposals` for previous similar signals.
- `backtestResults` for result labels and summary.
- `missingData` and `priceCoverage` for data quality warnings.

Recommended chart layout in detail page:

```txt
BACKTEST TOKEN: SOL
Lịch sử giá và độ đúng của các khuyến nghị tương tự

[line chart]
Markers:
- BUY/SELL/HOLD markers.
- Win/Loss/Pending/Breakeven colors.
- Current proposal marker highlighted.

Summary:
- Số khuyến nghị tương tự.
- Win-rate.
- ROI trung bình.
- Max drawdown, nếu có data.
- Data coverage.
```

Backtest UX rules:

- Backtest là bằng chứng tham khảo, không đảm bảo tương lai.
- Nếu missing price history, chart phải có warning.
- Nếu marker `priceStatus` là `PRICE_GAP_TOO_LARGE` hoặc `NO_PRICE_HISTORY`, marker cần state limited/muted.

## 13. Trust Badge / Model Health Logic

Overview and Proposal Detail both derive system badge from `modelHealth.data`.

Logic:

- If no modelHealth data -> `Đang cập nhật`.
- If active config not active, latest backtest fail/error, or no metrics -> `Dữ liệu hạn chế`.
- Else -> `Hệ thống ổn định`.

UX:

- Trust badge nhỏ, không chiếm decision flow.
- Link sang `/model-health`.
- Không show raw active config/metrics ở overview/detail first viewport.

## 14. Data Quality And Missing State

Wireframes cần có các state sau:

### No wallet

Overview:

- `Kết nối ví để xem khuyến nghị cá nhân hóa`.

### Loading

- Skeleton top metrics.
- Skeleton action cards.
- Skeleton chart.

### Empty

- Overview: `Không có việc cần xử lý ngay`.
- Portfolio: `Chưa có tài sản trong ví`.
- Recommendations: `Chưa có khuyến nghị trong nhóm này`.
- Timeline: `Chưa tải được timeline` hoặc `Chưa đủ dữ liệu timeline`.

### API error

- Có error state và retry nếu thêm implementation.

### Missing price

- Amber RiskBanner.
- Token row badge `Thiếu giá`.
- Total value không được xem là chắc chắn.

### Stale data

- Nếu latest data > 1h, Overview risk warning.

## 15. Suggested Wireframe Additions Missing From Old Draft

Những phần wireframe cũ chưa đủ nhưng code/data đã có hoặc nên có:

1. Quant / Điểm tín hiệu ngay trong detail header hoặc Advanced summary.
2. Drawer `Cách tính điểm tín hiệu`.
3. Drawer `Cách tính độ tin cậy`.
4. Backtest TOKEN chart với price line + markers.
5. Backtest summary table.
6. Data coverage warning cho chart.
7. Trade safety disabled reason.
8. `Theo dõi dữ liệu` state khi missing data.
9. `Đã theo dõi` badge.
10. Vị thế trade đang mở ở Overview.
11. Disclaimer tài chính.
12. Filter bar ở Recommendation Center.
13. Data quality filter ở Recommendation Center.
14. Empty/loading/error states.
15. `Cập nhật ví và giá` action ở Portfolio.
16. Direct vs indirect recommendation sections in Portfolio.
17. Trust badge linked to Trust Center.

## 16. Recommended Final Wireframe Hierarchy

### `/overview`

1. Page header with product question.
2. Trust badge + freshness.
3. Four metric cards.
4. RiskBanner if needed.
5. Today Action Queue, max 5.
6. Portfolio snapshot.
7. Open positions snapshot.
8. Indirect impacts.
9. Disclaimer.

### `/portfolio`

1. Page header + sync wallet action.
2. Four metric cards.
3. Missing price warning.
4. Holdings list with risk/data/related action.
5. Direct related recommendations.
6. Indirect impacts.

### `/recommendations`

1. Header.
2. Filter bar.
3. Tabs.
4. Recommendation list.
5. Empty/loading states.

Card hierarchy:

1. Token + action.
2. Portfolio impact.
3. Risk.
4. Expiry/status.
5. Confidence + optional explanation.
6. Quant + optional explanation.
7. Short reason.
8. Mini stats.
9. CTA `Xem chi tiết`, secondary `Theo dõi`.

### `/proposal/[id]`

1. Back.
2. Decision Header:
   - token/action/impact/status.
   - confidence + `Cách tính`.
   - quant + `Cách tính`.
   - risk/expiry/time left.
   - disabled reason if any.
   - one primary CTA.
3. Rationale.
4. Decision support.
5. Backtest TOKEN chart.
6. Disclaimer.
7. Advanced details.

## 17. Implementation Notes

If implementing the new wireframes:

- Reuse `deriveRecommendationStatus`, `derivePortfolioImpact`, `deriveIsWatched`.
- Do not duplicate status/impact logic inside components unless extracting a shared UI helper.
- Add `quantScore` prop to `RecommendationCard` if card should show `Điểm tín hiệu`.
- Add filter state/search params to `/recommendations`.
- Add drawer component near Proposal Detail or shared UI.
- Drawer can use `useProposalScoreExplanation(id)` already loaded in detail.
- Backtest chart should stay in detail page; overview/recommendation cards should only link to detail.
- Keep `Chuẩn bị giao dịch`, not `Thực thi`, unless trade preview has loaded and is safe.

