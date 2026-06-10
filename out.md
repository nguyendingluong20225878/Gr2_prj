# Prompt sửa FE trang Overview và kế hoạch cải thiện các trang tiếp theo

## Bối cảnh

Repo: `GR2_project`

Trang trọng tâm: `apps/web/app/overview/page.tsx`

Các file liên quan cần đọc trước khi sửa:

- `apps/web/app/overview/page.tsx`
- `apps/web/lib/hooks/useNdlData.ts`
- `apps/web/lib/utils/recommendationDerivation.ts`
- `apps/web/lib/utils/time.ts`
- `apps/web/app/api/portfolio/route.ts`
- `apps/web/app/api/portfolio/cross-impacts/route.ts`
- `apps/web/app/components/shared/NdlUi.tsx`

Nguồn dữ liệu overview hiện tại:

- `GET /api/portfolio`: holdings, investments, stats, missing price.
- `GET /api/proposals`: danh sách proposal.
- `GET /api/model-health`: trạng thái model.
- `GET /api/watchlist`: proposal đã theo dõi.
- `GET /api/portfolio/cross-impacts`: nguồn/tokens có ảnh hưởng gián tiếp đến danh mục.
- `POST /api/watchlist`: thêm proposal vào watchlist khi bấm `Theo dõi`.

## Prompt triển khai

Hãy đọc toàn bộ code liên quan đến trang Overview và sửa UI/logic theo các yêu cầu sau. Giữ style hiện tại của project, không refactor lan rộng ngoài phạm vi cần thiết, và chạy typecheck sau khi sửa.

### 1. Đổi section "Cần xử lý ngay" thành "Xem xét ngay"

Trong `apps/web/app/overview/page.tsx`, đổi tiêu đề section:

- Từ: `Cần xử lý ngay`
- Thành: `Xem xét ngay`

Mục đích: giảm cảm giác app đang thúc ép user giao dịch, vì đây chỉ là khuyến nghị hỗ trợ quyết định.

### 2. Chia "Xem xét ngay" thành 2 tab/filter nhỏ

Trong section `Xem xét ngay`, thêm filter/tab nhỏ để user chuyển giữa 2 nhóm:

1. `Ảnh hưởng danh mục`
   - Hiển thị proposal có `impact === DIRECT` hoặc `impact === INDIRECT`.
   - Đây là các khuyến nghị liên quan đến token user đang giữ hoặc nguồn ảnh hưởng gián tiếp đến danh mục.

2. `Ngoài danh mục`
   - Hiển thị proposal có `impact === OUTSIDE`.
   - Đây là cơ hội ngoài ví hiện tại, không nên trộn chung với nhóm ảnh hưởng danh mục.

Không cần gọi API mới. Dùng `recommendationItems` hiện có từ:

- `GET /api/proposals`
- `GET /api/portfolio`
- `GET /api/portfolio/cross-impacts`
- `GET /api/watchlist`

Logic hiện tại:

```ts
const actionableItems = recommendationItems
  .filter((item) => ['ACTIVE', 'EXPIRING_SOON', 'MISSING_DATA'].includes(item.status))
  .sort(sortTodayActions);
```

Yêu cầu sửa:

- Giữ điều kiện status actionable như trên.
- Tạo thêm 2 list:

```ts
const reviewItems = recommendationItems
  .filter((item) => ['ACTIVE', 'EXPIRING_SOON', 'MISSING_DATA'].includes(item.status))
  .sort(sortTodayActions);

const portfolioReviewItems = reviewItems.filter((item) =>
  item.impact === 'DIRECT' || item.impact === 'INDIRECT'
);

const outsideReviewItems = reviewItems.filter((item) => item.impact === 'OUTSIDE');
```

- Thêm local state, ví dụ:

```ts
const [reviewScope, setReviewScope] = useState<'portfolio' | 'outside'>('portfolio');
```

- Render segmented control/tabs trong section:
  - `Ảnh hưởng danh mục`
  - `Ngoài danh mục`

- `todayQueue` đổi thành list theo tab đang chọn:

```ts
const selectedReviewItems = reviewScope === 'portfolio'
  ? portfolioReviewItems
  : outsideReviewItems;

const todayQueue = selectedReviewItems.slice(0, 5);
```

- Các metric phía trên nếu còn dùng `actionableItems.length` thì cân nhắc đổi label/value:
  - `Việc cần xử lý hôm nay` nên đổi thành `Khuyến nghị cần xem xét`
  - value có thể là `reviewItems.length`

### 3. Không hiển thị "Ảnh hưởng" trong chi tiết từng token/card của "Xem xét ngay"

Hiện `TodayActionCard` đang hiển thị:

```tsx
<PortfolioImpactBadge impact={impact} />
...
<MiniImpact label="Ảnh hưởng" value={getPortfolioImpactLabel(impact)} />
```

Yêu cầu:

- Vì đã có tab/filter `Ảnh hưởng danh mục` và `Ngoài danh mục`, không cần lặp lại thông tin ảnh hưởng trong từng card.
- Xóa `PortfolioImpactBadge` khỏi header card trong `TodayActionCard`.
- Xóa mini stat:

```tsx
<MiniImpact label="Ảnh hưởng" value={getPortfolioImpactLabel(impact)} />
```

- Grid mini stat trong card có thể còn 3 item:
  - `Tin cậy`
  - `Rủi ro`
  - `Thời hạn`

Hoặc thêm một item hữu ích hơn như:

- `Nguồn`: số lượng sources nếu có.
- `Cập nhật`: relative time từ `proposal.updatedAt ?? proposal.createdAt`.

Không bắt buộc thêm item mới nếu layout vẫn đẹp với 3 item.

### 4. Rủi ro đang hiển thị 2 lần, xóa 1 chỗ

Hiện trong `TodayActionCard` rủi ro xuất hiện:

- Badge `RiskBadge risk={risk}` ở header card.
- Mini stat `<MiniImpact label="Rủi ro" value={toDisplayRisk(risk)} />`.

Yêu cầu:

- Chỉ giữ một chỗ.
- Nên giữ badge `RiskBadge` ở header vì màu giúp scan nhanh.
- Xóa mini stat `Rủi ro`.

Mini stat sau khi sửa nên còn:

- `Tin cậy`
- `Thời hạn`
- Có thể thêm `Nguồn` hoặc `Cập nhật`, hoặc để 2-3 cột tùy layout.

### 5. Sửa phần "Thiếu dữ liệu" trong card khuyến nghị

Hiện nếu status là `MISSING_DATA`, UI hiển thị câu:

```text
Thiếu dữ liệu giá, nguồn hoặc độ tin cậy. Hãy kiểm tra trước khi giao dịch.
```

Yêu cầu:

- Không hiển thị một câu chung chung như vậy nếu có thể chỉ ra thiếu gì.
- Tạo helper mới ở overview hoặc trong util:

```ts
function getMissingDecisionDataMessages(proposal: ProposalData) {
  const messages: string[] = [];
  const hasPrice = proposal.financialImpact?.currentPrice !== null && proposal.financialImpact?.currentPrice !== undefined ||
    proposal.financialImpact?.currentValue !== null && proposal.financialImpact?.currentValue !== undefined;
  const hasSource = Boolean(proposal.sources?.length || proposal.signalContext?.sources?.length);
  const hasConfidence = proposal.confidence !== null && proposal.confidence !== undefined;

  if (!hasPrice) messages.push('Chưa có giá tham chiếu');
  if (!hasSource) messages.push('Chưa có nguồn xác thực');
  if (!hasConfidence) messages.push('Chưa có độ tin cậy');

  return messages;
}
```

- Render dưới dạng text ngắn hoặc chips:

```text
Cần kiểm tra: Chưa có giá tham chiếu, Chưa có nguồn xác thực.
```

Ngôn ngữ cần thân thiện với người dùng, không dùng thuật ngữ kỹ thuật kiểu mapping/schema.

### 6. Sửa phần "lý do ngắn"

Hiện code lấy:

```ts
const shortReason = proposal.summary
  ?? proposal.rationaleSummary
  ?? proposal.title
  ?? proposal.reason?.[0]
  ?? 'Chưa có lý do ngắn cho khuyến nghị này.';
```

Yêu cầu:

- Nếu `proposal.reason` có nhiều câu/bullet, hãy lấy vài câu đầu để hiển thị, không chỉ lấy một câu nếu summary rỗng.
- Viết helper:

```ts
function getShortReason(proposal: ProposalData) {
  if (proposal.summary) return proposal.summary;
  if (proposal.rationaleSummary) return proposal.rationaleSummary;
  if (proposal.reason?.length) return proposal.reason.slice(0, 2).join(' ');
  if (proposal.title) return proposal.title;
  return 'Chưa có lý do ngắn cho khuyến nghị này.';
}
```

- Nếu text dài, vẫn dùng `line-clamp-2` hoặc `line-clamp-3`.
- Không làm UI card quá cao.

### 7. Phần "Khuyến nghị liên quan" trong "Tài sản đang nắm giữ" không lấy khuyến nghị hết hạn

Hiện `HoldingSnapshotRow` nhận `recommendations={recommendationItems}`, và `getHoldingRelatedRecommendationCount()` đếm theo token + `impact !== OUTSIDE`.

Yêu cầu:

- Không đếm những proposal có status:
  - `EXPIRED`
  - `VERIFIED`
  - `EXECUTED`

Chỉ đếm các proposal còn cần xem xét:

```ts
const relatedActiveCount = recommendations.filter((item) => {
  const proposalSymbol = normalizeSymbol(item.proposal.tokenSymbol ?? item.proposal.tokenName);
  return proposalSymbol === symbol &&
    item.impact !== 'OUTSIDE' &&
    ['ACTIVE', 'EXPIRING_SOON', 'MISSING_DATA'].includes(item.status);
}).length;
```

- Có thể đổi label:
  - Từ: `Khuyến nghị liên quan`
  - Thành: `Còn cần xem xét`

Nếu muốn rõ hơn, có thể hiển thị:

```text
2 còn cần xem xét
```

### 8. Bỏ phần "Dữ liệu" khỏi tài sản nếu đã có "Giá trị" và badge giá

Hiện holding row có:

```tsx
<MiniImpact label="Dữ liệu" value={missingPrice ? getMissingPriceReasonLabel(holding.missingReason) : 'Giá đã có'} />
```

Yêu cầu:

- Xóa mini stat `Dữ liệu`.
- Lý do: nếu đã hiển thị `Giá trị` và badge `Thiếu giá`/`Đủ dữ liệu giá`, thì stat `Dữ liệu: Giá đã có` bị thừa.
- Với trường hợp thiếu giá, dùng badge thân thiện hơn:
  - `Chưa nhận diện được token` nếu `missingReason === NO_TOKEN_MAPPING`
  - `Chưa có giá thị trường` nếu `missingReason === NO_PRICE`
  - `Thiếu giá` fallback

Gợi ý helper:

```ts
function getHoldingPriceBadgeLabel(holding: Holding) {
  if (holding.dataQuality !== 'MISSING_PRICE' && holding.price !== null && holding.price !== undefined) {
    return 'Đã có giá thị trường';
  }
  if (holding.missingReason === 'NO_TOKEN_MAPPING') return 'Chưa nhận diện được token';
  if (holding.missingReason === 'NO_PRICE') return 'Chưa có giá thị trường';
  return 'Thiếu giá';
}
```

Mini stat holding nên còn:

- `Số dư`
- `Giá trị`
- `Còn cần xem xét`

### 9. Hướng xử lý PnL trong "Vị thế trade đang mở"

Hiện overview lấy vị thế từ:

- `GET /api/portfolio`
- Backend đọc collection `perp_positions`

Trong `apps/web/app/api/portfolio/route.ts`, đoạn map investments hiện có:

```ts
pnl: null,
roi: normalizeNullableNumber(p.roi)
```

Nghĩa là UI luôn có thể hiện `Chưa có dữ liệu` cho PnL vì backend hardcode `pnl: null`.

Yêu cầu ngắn hạn:

- Sửa API portfolio để trả PnL nếu DB đã có:

```ts
pnl: normalizeNullableNumber(p.pnl),
roi: normalizeNullableNumber(p.roi)
```

Yêu cầu trung hạn:

- Cần có `markPrice` hoặc giá hiện tại của token để tính PnL.
- Nếu `perp_positions` có `markPrice`, `entryPrice`, `positionSize`, `positionDirection`, tính:

```ts
const direction = String(p.positionDirection ?? '').toUpperCase();
const entry = normalizeNullableNumber(p.entryPrice);
const mark = normalizeNullableNumber(p.markPrice ?? p.executedPrice);
const size = normalizeNullableNumber(p.positionSize);

const computedPnl = entry !== null && mark !== null && size !== null
  ? direction === 'SHORT'
    ? (entry - mark) * size
    : (mark - entry) * size
  : normalizeNullableNumber(p.pnl);
```

Nhưng cần kiểm tra `positionSize` đang là số lượng token hay size USD. Nếu `positionSize` là USD/collateral thì công thức phải khác. Không đoán bừa.

Yêu cầu dài hạn:

- Có worker/job hoặc API cập nhật mark price định kỳ.
- Hoặc mỗi lần gọi `/api/portfolio`, join token price mới nhất từ `token_prices` để tính markPrice/PnL.
- UI nên hiển thị:
  - `Chưa cập nhật PnL` nếu không có mark price.
  - `PnL tạm tính` nếu tính từ giá tham chiếu.

### 10. Sửa "Nguồn ảnh hưởng đến danh mục": hiển thị thời gian tương đối

Hiện `CrossImpactCard` dùng:

```ts
formatVietnameseDateTime(impact.createdAt)
```

Yêu cầu:

- Đổi sang:

```ts
formatRelativeVietnamese(impact.createdAt)
```

- Import thêm:

```ts
import { formatExpiry, formatRelativeVietnamese, formatVietnameseDateTime } from '@/lib/utils/time';
```

Hoặc nếu không còn dùng `formatVietnameseDateTime` trong card đó thì bỏ import thừa.

Kỳ vọng hiển thị:

- `3 giờ trước`
- `hôm qua`
- `2 ngày trước`

Nếu muốn rõ hơn:

```text
Nguồn cập nhật 3 giờ trước
```

### 11. Đổi section "Ảnh hưởng gián tiếp tới danh mục" sang token-first

Hiện card đang source-first:

```text
[source title]
Tài sản đang giữ: SOL
Token liên quan: ETH, BTC
Mức ảnh hưởng: ...
```

Yêu cầu đổi section title:

- Từ: `Ảnh hưởng gián tiếp tới danh mục`
- Thành: `Token có thể ảnh hưởng đến danh mục`

Mục tiêu UI:

- Người dùng nhìn thấy token nào cần chú ý trước.
- Nguồn chỉ là bằng chứng phía sau.

Gợi ý tạo helper để flatten cross-impact theo token:

```ts
type TokenImpactItem = PortfolioCrossImpact & {
  impactedToken: string;
};

const tokenImpactItems = crossPortfolioImpacts.flatMap((impact) =>
  impact.impactedTokens.map((token) => ({
    ...impact,
    impactedToken: token,
  }))
);
```

Render card mới:

```tsx
function TokenImpactCard({ impact }: { impact: TokenImpactItem }) {
  const sourceTime = impact.createdAt
    ? formatRelativeVietnamese(impact.createdAt)
    : 'Chưa có thời điểm nguồn';

  return (
    <div>
      <div>
        <p>{impact.impactedToken} có thể ảnh hưởng đến danh mục</p>
        <Badge>Ảnh hưởng gián tiếp</Badge>
      </div>
      <MiniImpact label="Liên quan tới tài sản" value={impact.holdingTokens.join(', ')} />
      <MiniImpact label="Nguồn" value={impact.sourceLabel} />
      <MiniImpact label="Thời điểm" value={sourceTime} />
      <p>{impact.reason}</p>
      {impact.sourceUrl ? <Link href={impact.sourceUrl} target="_blank">Mở nguồn dữ liệu</Link> : null}
    </div>
  );
}
```

Không nên hiển thị `Hiệu lực nguồn` ở overview nếu hạn này chỉ là `createdAt + PROPOSAL_TTL_MS` do FE tự suy diễn. Nếu vẫn cần, đổi label thành:

```text
Thời hạn tham khảo
```

Nhưng tốt nhất ở overview chỉ nên hiển thị thời điểm nguồn tương đối.

### 12. Kiểm thử sau khi sửa

Sau khi sửa, chạy:

```bash
/mnt/e/node.exe ./node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
```

Kiểm tra thủ công:

- Mở `/overview`.
- Section mới hiển thị `Xem xét ngay`.
- Có 2 tab/filter nhỏ: `Ảnh hưởng danh mục`, `Ngoài danh mục`.
- Proposal ngoài danh mục không trộn vào tab ảnh hưởng danh mục.
- Card không còn hiển thị rủi ro 2 lần.
- Card không còn hiển thị ảnh hưởng 2 lần.
- Missing data nói rõ thiếu giá/nguồn/confidence.
- Lý do ngắn lấy được 1-2 câu đầu từ `reason`.
- Holding không đếm proposal hết hạn/đã kiểm chứng/đã thực hiện.
- Holding không còn stat `Dữ liệu: Giá đã có`.
- Cross impact hiển thị token-first và thời gian tương đối.
- Typecheck pass.

## Gợi ý cải thiện các trang tiếp theo

### 1. Trang Recommendations

File:

- `apps/web/app/recommendations/page.tsx`
- `apps/web/app/recommendations/components/RecommendationCard.tsx`

Vấn đề cần kiểm tra:

- Có thể đang lặp lại risk/tag tương tự overview.
- Filter `urgent`, `portfolio`, `outside-portfolio` nên thống nhất logic với overview mới.
- Nếu overview đổi "Cần xử lý ngay" thành "Xem xét ngay", recommendations cũng nên đổi label `urgent` thành ngôn ngữ mềm hơn, ví dụ `Cần xem xét`.

Gợi ý sửa:

- Đồng bộ helper `getShortReason()`.
- Đồng bộ helper missing-data messages.
- Tách tab `portfolio` và `outside-portfolio` rõ hơn.
- Card nên ưu tiên token/action/confidence/thời hạn, không nhồi quá nhiều mini stat.

### 2. Trang Proposal Detail

File:

- `apps/web/app/proposal/[id]/page.tsx`

Vấn đề cần kiểm tra:

- Action `WAIT`, `REJECT`, `Chuẩn bị giao dịch` cần copy rõ ràng hơn: đây là quyết định/audit, không phải khuyến nghị tài chính chắc chắn.
- Nếu proposal `MISSING_DATA`, trang detail nên chỉ rõ thiếu field nào như overview.
- `Theo dõi` hiện gọi decision `WAIT` và thêm watchlist; cần chắc UI nói đúng: "Theo dõi" khác "Từ chối" và khác "Chuẩn bị giao dịch".

Gợi ý sửa:

- Dùng cùng helper missing-data messages.
- Dùng cùng logic status label.
- Với proposal hết hạn/đã kiểm chứng, disable action rõ hơn.

### 3. Trang Trade

File:

- `apps/web/app/proposal/[id]/trade/page.tsx`
- `apps/web/app/api/trade/preview/route.ts`
- `apps/web/app/api/trade/execute/route.ts`

Vấn đề cần kiểm tra:

- Đây là demo trade, không phải trade thật. UI phải nói rõ.
- Preview đang tính fee/slippage/stop-loss từ dữ liệu proposal. Nếu thiếu dữ liệu, status `LIMITED`.
- Sau execute tạo `perp_positions`, nhưng PnL chưa cập nhật thật.

Gợi ý sửa:

- Gắn label `Giao dịch mô phỏng`.
- Hiển thị warning nếu preview `LIMITED`.
- Sau execute, position detail phải nói PnL là tạm tính/chưa cập nhật.

### 4. Trang Positions

File:

- `apps/web/app/positions/page.tsx`
- `apps/web/app/positions/[id]/page.tsx`
- `apps/web/app/api/portfolio/route.ts`

Vấn đề cần kiểm tra:

- PnL hiện chưa có nguồn dữ liệu đáng tin.
- Nút `Đóng`, `Ghi chú` hiện chỉ toast mô phỏng.

Gợi ý sửa:

- Nếu chưa có API đóng vị thế, đổi text thành `Mô phỏng đóng` hoặc ẩn nút.
- Hiển thị `PnL tạm tính` nếu tính từ mark price.
- Thêm API/update flow cho `perp_positions.status = closed` nếu muốn đóng thật trong DB.

### 5. Trang Portfolio

File:

- `apps/web/app/portfolio/page.tsx`

Vấn đề cần kiểm tra:

- Data quality label nên thân thiện giống overview.
- `Cập nhật ví và giá` thực ra chỉ sync balances từ ví và lưu profile; giá vẫn phụ thuộc backend/token_prices.

Gợi ý sửa:

- Đổi button thành `Đồng bộ ví`.
- Hint phụ: `Giá thị trường được cập nhật từ hệ thống dữ liệu`.
- Không hiển thị thuật ngữ `mapping`.

### 6. Trang Watchlist

File:

- `apps/web/app/watchlist/page.tsx`

Vấn đề cần kiểm tra:

- Watchlist đang nhóm pending/verified/expired.
- Cần tránh hiển thị proposal hết hạn như cơ hội hành động.

Gợi ý sửa:

- Với expired: copy rõ `Chỉ để tham khảo`.
- Với resolved/verified: hiển thị kết quả/PnL nếu có.
- Nút xóa đang hợp lý, giữ confirm.

### 7. Trang Alerts

File:

- `apps/web/app/alerts/page.tsx`

Vấn đề cần kiểm tra:

- Alert đang tự suy ra từ nhiều nguồn, có thể gây trùng với overview.
- Nên phân loại alert: dữ liệu, thời hạn, giá, danh mục.

Gợi ý sửa:

- Dùng cùng wording missing data.
- Link alert đến đúng proposal/token.
- Ưu tiên alert liên quan danh mục trước.

### 8. Trang Data Check và Diagnostics

File:

- `apps/web/app/data-check/page.tsx`
- `apps/web/app/diagnostics/page.tsx`

Vấn đề cần kiểm tra:

- Đây là trang kỹ thuật hơn, có thể dùng thuật ngữ sâu hơn nhưng vẫn nên tránh `mapping` nếu user thường.

Gợi ý sửa:

- Data-check có thể giữ chi tiết kỹ thuật trong phần phụ.
- Diagnostics nên giải thích "thiếu nhận diện token" thay vì "thiếu mapping".

### 9. Trang Token Detail

File:

- `apps/web/app/tokens/[symbol]/page.tsx`

Vấn đề cần kiểm tra:

- Trang token đang gom holding/proposal/signal theo symbol.
- Nếu symbol là `TOKEN CHƯA ĐỊNH DANH`, route/token view có thể kém hữu ích.

Gợi ý sửa:

- Nếu token chưa định danh, ưu tiên hiển thị token address.
- Link recommendations với query `token=symbol` chỉ nên có khi symbol rõ ràng.

### 10. Trang Model Health

File:

- `apps/web/app/model-health/page.tsx`

Vấn đề cần kiểm tra:

- Đây là nguồn trust badge cho overview/proposal.
- Cần đảm bảo copy dễ hiểu: model ổn không có nghĩa là khuyến nghị chắc thắng.

Gợi ý sửa:

- Thêm giải thích "độ tin cậy hệ thống" khác "độ tin cậy của từng proposal".
- Hiển thị thời điểm backtest/update tương đối.

## Tóm tắt yêu cầu Overview cần làm ngay

1. Đổi `Cần xử lý ngay` thành `Xem xét ngay`.
2. Thêm 2 tab/filter trong section:
   - `Ảnh hưởng danh mục`
   - `Ngoài danh mục`
3. Không lặp thông tin `Ảnh hưởng` trong card khuyến nghị.
4. Xóa rủi ro bị hiển thị 2 lần.
5. Missing data phải chỉ rõ thiếu giá/nguồn/confidence.
6. Lý do ngắn lấy 1-2 câu đầu từ `reason` nếu không có summary.
7. Holding chỉ đếm khuyến nghị còn actionable, không đếm hết hạn/verified/executed.
8. Bỏ stat `Dữ liệu: Giá đã có`; dùng badge giá thân thiện hơn.
9. Hướng xử lý PnL: backend `/api/portfolio` không được hardcode `pnl: null`; cần lấy/tính PnL.
10. Cross-impact đổi sang token-first, thời gian tương đối, không source-first.

