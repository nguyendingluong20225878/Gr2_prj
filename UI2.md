# NDL UX/UI Redesign Implementation Spec

## 1. Mục Tiêu

NDL cần được redesign từ cảm giác **dashboard nội bộ cho proposal/model** thành một **trợ lý quyết định crypto cá nhân**.

Sản phẩm phải trả lời nhanh các câu hỏi:

- Hôm nay ví crypto của tôi cần xử lý gì?
- Token nào trong danh mục đang có rủi ro?
- Khuyến nghị nào liên quan trực tiếp tới holdings của tôi?
- Tôi nên mua, bán, giữ, theo dõi hay bỏ qua?
- Tôi có nên tin khuyến nghị này không?
- Dữ liệu này còn mới và còn hiệu lực không?

Nguyên tắc bắt buộc:

- **Portfolio-first, signal-second**: bắt đầu từ danh mục, sau đó mới tới tín hiệu.
- **Decision before explanation**: đưa kết luận/hành động lên trước, giải thích sau.
- **User language before system language**: dùng ngôn ngữ của trader/user, không dùng ngôn ngữ backend/model.
- **Technical data only in Advanced/Debug**: dữ liệu kỹ thuật chỉ xuất hiện ở chế độ nâng cao hoặc debug.

## 2. Định Nghĩa Sản Phẩm

NDL không nên được định vị là một dashboard hiển thị signal. Định vị đúng là:

> NDL là trợ lý quyết định crypto cá nhân: bắt đầu từ danh mục người dùng, phân tích tín hiệu, news, model score và rủi ro, sau đó giúp user biết hôm nay nên mua, bán, giữ, theo dõi hay bỏ qua token nào.

Lời hứa cốt lõi với user:

> "Mở app lên, tôi biết ngay hôm nay danh mục của mình có gì cần chú ý và vì sao."

## 3. Vấn Đề Hiện Tại

### P0 - UI Đang Lộ Quá Nhiều Thuật Ngữ Nội Bộ

UI hiện tại đang để lộ nhiều từ giống backend/model hơn là ngôn ngữ user.

| Hiện tại | Nên đổi thành |
|---|---|
| Proposal | Khuyến nghị / Luận điểm |
| Quant | Điểm tín hiệu |
| Cross-impact | Ảnh hưởng gián tiếp |
| Diagnostics | Kiểm tra rủi ro |
| Model Health | Độ tin cậy hệ thống |
| Backtest | Kết quả kiểm chứng |
| Active config | Ẩn trong Advanced/Debug |
| API path | Không hiển thị trong UI |

Acceptance criteria:

- Không còn `/api/proposals`, `/api/portfolio/cross-impacts` hoặc bất kỳ API path nào trong UI user-facing.
- Không dùng chữ "Proposal" ở nav, card title, empty state, CTA user-facing.
- Technical terms chỉ xuất hiện trong Advanced View hoặc Debug Mode.
- User hiểu hành động chính mà không cần biết backend/model hoạt động thế nào.

### P0 - Navigation Đang Phân Tán Decision Workflow

Navigation hiện tại có quá nhiều mục ngang hàng:

- Tổng quan
- Danh mục
- Chẩn đoán
- Khuyến nghị
- Cơ hội
- Theo dõi
- Vị thế
- Cảnh báo
- Mô hình

Vấn đề: user không biết nên vào đâu để trả lời câu hỏi "hôm nay tôi nên làm gì?".

### P1 - Overview Chưa Đủ Giống Decision Inbox

Overview đang có nền đúng, nhưng cần trở thành màn hình xử lý chính:

> "Hôm nay tôi cần xử lý gì với danh mục crypto của mình?"

### P1 - Recommendation Detail Chưa Ưu Tiên Decision Summary

Detail page hiện có rationale, confidence, quant, timeline và source. Đây là nền tốt, nhưng first viewport cần đưa decision summary lên trước.

## 4. Implementation Mapping

| Area | Route/component hiện tại | Loại thay đổi | Priority |
|---|---|---|---|
| Main navigation | `apps/web/app/components/layout/navigationItems.ts` | Rút nav, đổi IA | P0 |
| Navbar desktop | `apps/web/app/components/layout/Navbar.tsx` | Render nav mới | P0 |
| Mobile nav | `apps/web/app/components/layout/MobileBottomNav.tsx` | Đồng bộ nav mới | P0 |
| Overview | `apps/web/app/overview/page.tsx` | Biến thành Today Decision Inbox | P0 |
| Recommendations | `apps/web/app/recommendations/page.tsx` | Trung tâm khuyến nghị | P1 |
| Recommendation card | `apps/web/app/recommendations/components/RecommendationCard.tsx` | Thêm impact/risk/expiry hierarchy | P1 |
| Opportunities | `apps/web/app/opportunities/page.tsx` | Redirect/gộp vào Recommendations | P1 |
| Proposal detail | `apps/web/app/proposal/[id]/page.tsx` | Decision Header + CTA hierarchy | P0 |
| Portfolio | `apps/web/app/portfolio/page.tsx` | Holdings + risk + related actions | P1 |
| Watchlist | `apps/web/app/watchlist/page.tsx` | Giữ riêng, tránh trùng Recommendations | P2 |
| Model health | `apps/web/app/model-health/page.tsx` | Trust Center/Advanced | P1 |
| Shared UI | `apps/web/app/components/shared/NdlUi.tsx` | Badge/card/banner reusable | P1 |

## 5. Route Và Information Architecture

### Main Nav Mới

Main navigation chỉ còn 5 mục:

1. Tổng quan
2. Danh mục
3. Khuyến nghị
4. Theo dõi
5. Vị thế

### Route Behavior

| Route hiện tại | Hành vi mới |
|---|---|
| `/overview` | Giữ, thành Today Decision Inbox |
| `/portfolio` | Giữ, thêm risk/data quality section |
| `/recommendations` | Giữ, gom khuyến nghị và cơ hội |
| `/opportunities` | Redirect sang `/recommendations?tab=outside-portfolio` |
| `/watchlist` | Giữ riêng |
| `/positions` | Giữ |
| `/alerts` | Không ở nav chính, đưa vào Overview |
| `/diagnostics` | Không ở nav chính, đưa vào Portfolio/Risk |
| `/model-health` | Không ở nav chính, chuyển Advanced/Trust Center |

### Redirect Implementation Detail

`/opportunities`:

- Nên dùng server redirect nếu page không còn cần render độc lập.
- Target: `/recommendations?tab=outside-portfolio`.
- Old external links vẫn được support thông qua redirect.
- Không hiển thị `/opportunities` trong nav desktop/mobile.

Tab search params trong `/recommendations`:

| Search param | Tab |
|---|---|
| `?tab=urgent` | Cần xử lý ngay |
| `?tab=portfolio` | Liên quan danh mục |
| `?tab=outside-portfolio` | Ngoài danh mục |
| `?tab=verified` | Đã kiểm chứng |
| `?tab=expired` | Hết hiệu lực |

Acceptance criteria:

- Main nav tối đa 5 mục.
- Mobile nav không hiển thị `/alerts`, `/diagnostics`, `/model-health`, `/opportunities`.
- `/opportunities` không còn là destination chính của user flow.
- Không có 2 nav item cùng trả lời câu hỏi "hôm nay tôi nên làm gì?".

## 6. Data Contract Và Field Mapping

Tài liệu UI không được giả định backend đã có sẵn mọi field. Các field cần phân loại rõ: lấy trực tiếp từ API, derive ở frontend, hay cần backend bổ sung.

### Recommendation Card Data Mapping

| UI field | Source hiện có | Cách xử lý |
|---|---|---|
| `tokenSymbol` | `proposal.tokenSymbol` | Direct |
| `action` | `proposal.action ?? proposal.suggestionType` | Direct with fallback |
| `confidence` | `proposal.confidence` | Direct, normalize bằng formatter hiện có |
| `riskLevel` | `proposal.financialImpact?.riskLevel` | Direct nếu có, fallback `UNKNOWN` |
| `expiresAt` | `proposal.expiresAt` | Direct |
| `status` | `proposal.status`, `expiresAt`, `backtestedAt`, `winLossStatus`, `pnlPercentage` | Derived |
| `isWatched` | `watchlist.data` matching `proposal._id` | Derived frontend |
| `portfolioImpact` | holdings + crossImpacts + token match | Derived frontend |
| `sourceQuality` | `proposal.sources`, `signalContext.metadata.sampleSize` nếu có | Derived cho tới khi backend có score |
| `shortReason` | `summary ?? rationaleSummary ?? title ?? reason[0]` | Direct with fallback |
| `missingData` | price/status fields, `dataQuality`, timeline missing data nếu có | Derived |

### Portfolio Impact Derivation

`portfolioImpact` không được giả định là backend field trừ khi backend bổ sung sau.

Derived rules:

| Impact | Rule |
|---|---|
| `DIRECT` | `proposal.tokenSymbol` nằm trong current holdings symbol set |
| `INDIRECT` | proposal id xuất hiện trong `crossImpacts.proposalIds` và không phải direct |
| `OUTSIDE` | không direct và không indirect |
| `UNKNOWN` | holdings/crossImpacts chưa load |

Display labels:

| Value | Label |
|---|---|
| `DIRECT` | Ảnh hưởng trực tiếp |
| `INDIRECT` | Ảnh hưởng gián tiếp |
| `OUTSIDE` | Ngoài danh mục |
| `UNKNOWN` | Chưa xác định |

### Status Derivation

| UI status | Rule |
|---|---|
| `ACTIVE` | chưa expired và chưa có kết quả kiểm chứng |
| `EXPIRING_SOON` | active và `expiresAt - now <= EXPIRING_SOON_WINDOW_MS` |
| `EXPIRED` | `isExpired(expiresAt)` |
| `VERIFIED` | có `backtestedAt` hoặc `winLossStatus` hoặc `pnlPercentage` |
| `EXECUTED` | `status === executed` hoặc có investment/execution |
| `MISSING_DATA` | thiếu price/currentPrice/sample/source fields cần cho quyết định |

### Backend Fields Có Thể Cần Sau

| Field | Lý do | Sprint |
|---|---|---|
| `sourceQualityScore` | Thay heuristic source quality | Later |
| `portfolioImpact` | Tránh duplicate logic derive ở frontend | Later |
| `staleDataStatus` | Data freshness đáng tin cậy từ backend | Sprint 2 |
| `executeEligibility` | Centralize lý do execute được/không được | Sprint 2 |
| `recommendationPriorityReason` | Giải thích vì sao item urgent/today/watch | Sprint 2 |

## 7. Copy Replacement Checklist

Áp dụng cho toàn bộ user-facing UI.

| Hiện tại | Đổi thành |
|---|---|
| Proposal | Khuyến nghị / Luận điểm |
| Quant | Điểm tín hiệu |
| Cross-impact | Ảnh hưởng gián tiếp |
| Diagnostics | Kiểm tra rủi ro |
| Model Health | Độ tin cậy hệ thống |
| Backtest | Kết quả kiểm chứng |
| Active config | Advanced only |
| API path | Remove |

Copy scan acceptance criteria:

- Không còn API path trong UI text.
- Không còn "Proposal" ở title, card, empty state, CTA user-facing.
- Raw JSON/config chỉ nằm trong Advanced/Debug.
- Copy chính dùng ngôn ngữ trader/user.

## 8. Screen Priority

| Screen | Priority | Reason |
|---|---|---|
| Navbar | P0 | Giảm confusion toàn hệ thống |
| Overview | P0 | Entry point chính |
| Recommendation Detail | P0 | Nơi user ra quyết định |
| Recommendations | P1 | Chuẩn hóa signal workflow |
| Portfolio | P1 | Gắn action với holdings |
| Trust Center | P1 | Tăng trust nhưng không chiếm workflow |
| Watchlist | P2 | Quan trọng, nhưng sau core decision flow |

## 9. Overview Spec

### Vai Trò

`/overview` là **Today Decision Inbox**.

### Required Sections

1. Header
2. Top Metrics
3. Risk Banner
4. Today Action Queue
5. Portfolio Holdings Snapshot
6. Indirect Impact / Outside Opportunities

### Required Metric Cards

- Tổng giá trị danh mục
- Việc cần xử lý hôm nay
- Rủi ro cần chú ý
- Tín hiệu sắp hết hạn

### Today Action Card Required Fields

- token
- action
- confidence
- risk
- timeLeft
- portfolioImpact
- shortReason
- primaryCTA

### Item Limit

- Today Action Queue hiển thị tối đa 5 items.
- Nếu có hơn 5 items, hiển thị CTA `Xem tất cả khuyến nghị`.
- Sắp xếp theo priority: expiring soon, direct portfolio impact, sell/high risk, confidence, createdAt.

### Empty/Loading/Error States

| State | UI |
|---|---|
| No wallet | `Kết nối ví để xem khuyến nghị cá nhân hóa` + CTA connect |
| Loading | Skeleton top metrics + action cards |
| No urgent items | `Không có việc cần xử lý ngay` |
| Missing price | Amber Risk Banner |
| API error | Error state with retry |

Acceptance criteria:

- Có section title `Cần xử lý ngay`.
- Nếu không có item, hiển thị `Không có việc cần xử lý ngay`.
- Mỗi card trong action queue có đủ token, action, confidence, risk, expiry, portfolio impact.
- Có trust badge nhỏ trong header.
- Không render API path hoặc technical source route.

## 10. Recommendation Center Spec

`/recommendations` gom recommendations và opportunities.

### Tabs

1. Cần xử lý ngay
2. Liên quan danh mục
3. Ngoài danh mục
4. Đã kiểm chứng
5. Hết hiệu lực

Không dùng tab "Đang theo dõi" nếu đã có `/watchlist`. Chỉ dùng badge `Đã theo dõi` hoặc filter.

### Filters

- Action
- Confidence
- Risk
- Expiry
- Portfolio relevance
- Token
- Source quality

Acceptance criteria:

- User phân biệt rõ khuyến nghị liên quan danh mục và cơ hội ngoài danh mục.
- Card có CTA `Xem chi tiết` và optional `Theo dõi`.
- Expired recommendation không được trình bày như cơ hội hành động mới.
- Opportunities page redirect hoặc không còn xuất hiện ở nav.

## 11. Recommendation Card Component Spec

Component: `RecommendationCard`

### Props Proposal

```ts
type PortfolioImpact = 'DIRECT' | 'INDIRECT' | 'OUTSIDE' | 'UNKNOWN';
type RecommendationStatus =
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'VERIFIED'
  | 'EXECUTED'
  | 'MISSING_DATA';

type RecommendationCardProps = {
  id: string;
  tokenSymbol?: string | null;
  action?: string | null;
  confidence?: number | null;
  riskLevel?: string | null;
  expiresAt?: string | Date | null;
  portfolioImpact: PortfolioImpact;
  status: RecommendationStatus;
  isWatched?: boolean;
  summary?: string | null;
  sourceQualityLabel?: string | null;
  href: string;
  onWatch?: () => void;
};
```

### Badge Order

Badge order trên card:

1. Action
2. Portfolio impact
3. Risk
4. Expiry/status
5. Watched

### Variants

| Variant | Usage |
|---|---|
| `compact` | Overview action queue |
| `detailed` | Recommendations grid/list |
| `archived` | Verified/expired lists |

### States

| State | UI rule |
|---|---|
| Active | CTA xem chi tiết rõ |
| Expiring soon | Amber badge |
| Expired | Muted style, no primary action |
| Verified | Badge `Đã kiểm chứng`, show result nếu có |
| Watched | Badge `Đã theo dõi` |
| Direct impact | Badge `Ảnh hưởng trực tiếp` |
| Indirect impact | Badge `Ảnh hưởng gián tiếp` |
| Outside portfolio | Badge `Ngoài danh mục` |
| Missing data | Warning inline |

Acceptance criteria:

- Card không thay đổi layout khi badge/text dài.
- Mobile card single-column, CTA nằm dưới content.
- Expired card không hiển thị CTA execute/trade.
- Direct impact card phải scan được nhanh hơn outside portfolio card.

## 12. Proposal Detail / Recommendation Detail Spec

User-facing name: `Chi tiết khuyến nghị`.

### First Viewport Required

- Token
- Action
- Confidence
- Risk
- Time left
- Portfolio impact
- Primary CTA

### CTA Hierarchy

| Type | Example | Style |
|---|---|---|
| Primary | Theo dõi hoặc Execute | Solid |
| Secondary | Chờ vùng giá | Outline |
| Tertiary | Từ chối | Muted red outline |
| Utility | Xem chi tiết kỹ thuật | Ghost/link |

Rule:

- Chỉ 1 primary CTA trên first viewport.
- Nếu expired, execute intent hidden or disabled.
- Nếu missing/stale data, primary CTA phải bị giảm cấp hoặc cần confirmation.

### Layout Order

1. Decision Header
2. Why This Recommendation Exists
3. Decision Support
4. Evidence
5. Advanced Technical Details

### DecisionHeader Component Spec

Required fields:

- tokenSymbol
- action
- confidence
- riskLevel
- expiresAt
- portfolioImpact
- status
- primaryAction
- disabledReason

Acceptance criteria:

- User thấy action/risk/confidence trong first viewport.
- Chỉ có 1 primary CTA nổi bật.
- Nếu expired, ẩn/disable execute intent.
- Technical breakdown nằm dưới hoặc trong Advanced.
- Có warning nếu data stale, missing, hoặc signal hết hạn.

## 13. Portfolio Spec

### Required Sections

1. Portfolio Summary
2. Holdings List
3. Data Quality Warnings
4. Related Recommendations
5. Indirect Impact

### Holding Row Fields

- token
- balance
- value
- dataStatus
- relatedRecommendationCount
- riskStatus

Acceptance criteria:

- Token thiếu giá được đánh dấu rõ.
- Holding có khuyến nghị active có CTA mở chi tiết.
- User biết token nào trong ví đang có rủi ro.
- Không dùng total value như nguồn tin chắc chắn khi missing price.

## 14. RiskBanner Component Spec

Purpose: hiển thị các vấn đề cần chú ý trước khi user ra quyết định.

Required fields:

```ts
type RiskBannerSeverity = 'info' | 'warning' | 'critical';

type RiskBannerProps = {
  severity: RiskBannerSeverity;
  title: string;
  description?: string;
  issueCount?: number;
  affectedTokens?: string[];
  ctaLabel?: string;
  ctaHref?: string;
};
```

States:

| Severity | Usage |
|---|---|
| info | No critical issue, trust/data note |
| warning | Missing price, expiring signals, stale data |
| critical | Execute unsafe, severe missing data, wallet issue |

Acceptance criteria:

- Warning/critical banner xuất hiện trên Overview trước action queue.
- Banner không chỉ dùng màu, phải có text reason.
- Nếu có affected tokens, hiển thị tối đa 3 token + count còn lại.

## 15. TrustBadge Component Spec

Purpose: trust visible but quiet.

Required fields:

```ts
type TrustStatus = 'stable' | 'limited' | 'degraded' | 'unknown';

type TrustBadgeProps = {
  status: TrustStatus;
  label: string;
  lastCheckedAt?: string | Date | null;
  href?: string;
};
```

Mapping:

| Status | Label |
|---|---|
| stable | Hệ thống ổn định |
| limited | Dữ liệu hạn chế |
| degraded | Cần kiểm tra |
| unknown | Đang cập nhật |

Acceptance criteria:

- Trust badge xuất hiện trên Overview và Recommendation Detail.
- Badge click được sang Trust Center/Advanced nếu có route.
- Không đặt Trust Center trong main nav.

## 16. PortfolioImpactBadge Component Spec

Required props:

```ts
type PortfolioImpactBadgeProps = {
  impact: 'DIRECT' | 'INDIRECT' | 'OUTSIDE' | 'UNKNOWN';
  reason?: string;
};
```

Labels:

| Impact | Label |
|---|---|
| DIRECT | Ảnh hưởng trực tiếp |
| INDIRECT | Ảnh hưởng gián tiếp |
| OUTSIDE | Ngoài danh mục |
| UNKNOWN | Chưa xác định |

Acceptance criteria:

- Mỗi RecommendationCard phải có PortfolioImpactBadge.
- Badge có tooltip/copy ngắn giải thích lý do nếu có.
- DIRECT visually more prominent than OUTSIDE.

## 17. Trust And Safety Spec

Safety là P0.

Required UI:

- Non-financial-advice disclaimer
- Wallet permission explanation
- Data freshness label
- Risk confirmation before execute
- Stale data warning
- Expired signal warning

Copy gợi ý:

```text
NDL không phải cố vấn tài chính. Khuyến nghị chỉ là dữ liệu hỗ trợ quyết định. Bạn chịu trách nhiệm với mọi giao dịch.
```

```text
Ứng dụng chỉ đọc dữ liệu ví cần thiết để cá nhân hóa danh mục. NDL không thể tự thực hiện giao dịch nếu bạn chưa xác nhận.
```

Acceptance criteria:

- Có disclaimer trong onboarding/login hoặc footer.
- Có confirmation modal trước Execute.
- Có `last updated` hoặc data freshness label ở dashboard/detail.
- Model/Trust status hiển thị dạng badge nhỏ, không chiếm main nav.

## 18. State-Based UX

| State | Required UI |
|---|---|
| No wallet | Connect wallet state + wallet permission explanation |
| Wallet connected, no holdings | Empty holdings + CTA sync + outside opportunities |
| Holdings with missing price | Warning, total value marked partial/uncertain |
| Holdings with active recommendations | Today Action Queue + related cards |
| Expired recommendation | Muted state, no execute intent |
| API loading | Skeleton with stable dimensions |
| API error | Error state + retry |
| Stale data | Warning + last updated |

## 19. Visual Hierarchy Rules

### CTA

- Primary CTA: solid brand color, chỉ 1 cái trên mỗi màn/first viewport.
- Secondary CTA: outline.
- Tertiary/destructive: muted red outline.
- Utility: ghost/link style.

### Color Semantics

| Meaning | Color |
|---|---|
| BUY / positive | Green |
| SELL / danger | Red |
| Warning / expiring / missing data | Amber |
| Neutral / hold / watch | Slate or soft purple |
| Trust / info | Cyan |
| Brand accent | Purple/cyan, dùng tiết chế |

### Card Density

- Overview: compact, scan nhanh.
- Recommendations: detailed enough for comparison.
- Detail page: explanation-heavy.
- Mobile: single-column, CTA dưới nội dung.

### Empty/Loading/Error Style

- Empty state phải nói rõ "không có gì" và "nên làm gì tiếp".
- Loading skeleton phải giữ kích thước để tránh layout shift.
- Error state phải có retry nếu action có thể retry.

## 20. Analytics Event Spec

Success metrics chỉ đo được nếu có event mapping.

| Metric | Events |
|---|---|
| Time to first decision | `overview_viewed`, `overview_first_action_visible` |
| Recommendation detail open rate | `recommendation_card_clicked` |
| Watch/Reject/Execute rate | `decision_submitted` |
| Alert dismissal/noise | `risk_banner_dismissed`, `alert_dismissed` |
| Wallet connect completion | `wallet_connect_started`, `wallet_connect_completed`, `wallet_connect_failed` |
| Stale data warning visibility | `stale_data_warning_viewed` |
| Expired action attempts | `expired_execute_attempted` |
| Trust detail interest | `trust_badge_clicked` |

Event payload suggestions:

```ts
type RecommendationEventPayload = {
  proposalId: string;
  tokenSymbol?: string;
  action?: string;
  status?: string;
  portfolioImpact?: string;
  confidence?: number | null;
  riskLevel?: string | null;
};
```

Không block Sprint 1 nếu chưa có analytics infra. Nếu chưa có tracking helper, thêm event names vào implementation comments/backlog.

## 21. QA And Test Plan

### Copy Scan Tests

- Fail nếu user-facing copy chứa `/api/`.
- Fail nếu default UI chứa `Active config`.
- Fail nếu default UI chứa raw JSON blocks ngoài Advanced/Debug.
- Flag user-facing `Proposal` trừ khi route/file là internal technical code.

### Route Tests

| Case | Expected |
|---|---|
| Visit `/opportunities` | Redirect to `/recommendations?tab=outside-portfolio` |
| Main nav render | Only 5 core nav items |
| Mobile nav render | Only 5 core nav items or approved mobile subset |
| Visit `/model-health` | Accessible as advanced/trust page, not in nav |

### Overview Tests

| Case | Expected |
|---|---|
| No wallet | Connect wallet empty state |
| Loading data | Skeleton rendered |
| No urgent item | `Không có việc cần xử lý ngay` |
| Missing price | Warning banner |
| More than 5 actions | Show first 5 + `Xem tất cả khuyến nghị` |

### RecommendationCard Tests

| Case | Expected |
|---|---|
| Expired recommendation | Execute CTA hidden/disabled |
| Direct holding match | Badge `Ảnh hưởng trực tiếp` |
| Cross impact match | Badge `Ảnh hưởng gián tiếp` |
| No holding/cross impact | Badge `Ngoài danh mục` |
| Watched item | Badge `Đã theo dõi` |
| Missing price/data | Warning inline |

### Detail Tests

| Case | Expected |
|---|---|
| Active recommendation | Decision Header has primary CTA |
| Expired recommendation | Execute hidden/disabled |
| Verified recommendation | Shows result, not new action framing |
| Missing data | Warning visible before execute |
| Multiple CTA | Only one primary style |

### Portfolio Tests

| Case | Expected |
|---|---|
| Missing price token | Marked clearly |
| Partial total value | Copy says value is incomplete |
| Holding with active recommendation | Related CTA visible |
| No holdings | Empty state + sync CTA |

## 22. Dev Ticket Breakdown

### Sprint 1 - Foundation

```text
FE-01: Update main navigation to 5 core items
FE-02: Remove /alerts, /diagnostics, /model-health, /opportunities from main nav
FE-03: Replace user-facing technical terminology
FE-04: Remove API/internal paths from UI copy
FE-05: Add Overview Today Action Queue
FE-06: Add Risk Banner to Overview
FE-07: Add Decision Header to recommendation detail
FE-08: Refactor CTA hierarchy on recommendation detail
FE-09: Add disclaimer and wallet permission copy
FE-10: Add stale data / expired signal warning states
FE-11: Add data derivation helpers for portfolioImpact/status/isWatched
FE-12: Add QA copy scan checklist/test
```

### Sprint 2 - Workflow Polish

```text
FE-13: Merge Opportunities into Recommendations tabs
FE-14: Add PortfolioImpactBadge component
FE-15: Add recommendation filters
FE-16: Add TrustBadge component
FE-17: Move model health details into Advanced/Trust Center
FE-18: Add reusable recommendation card states
FE-19: Add data freshness labels
FE-20: Add analytics event hooks if infra exists
```

### Later

```text
FE-21: Token detail page chuyên sâu
FE-22: Compare multiple recommendations for same token
FE-23: Notification rule customization
FE-24: Risk profile personalization
FE-25: Advanced backtest visualization
```

## 23. Definition Of Done

Redesign MVP đạt khi:

- Main nav còn 5 mục.
- Overview có `Cần xử lý ngay`.
- Recommendation card có token, action, confidence, risk, expiry, portfolio impact.
- Detail page có Decision Header trước rationale/evidence.
- Không còn API/backend wording trong UI chính.
- Có disclaimer và risk warning.
- Expired signal không thể bị hiểu là cơ hội hành động mới.
- User mới hiểu app làm gì sau login/onboarding.
- User có ví biết token nào cần chú ý trong 10 giây đầu ở dashboard.
- Data-derived fields được map rõ: direct API, frontend derived, or backend needed.
- QA checklist cho route/component core được pass.

## 24. Final Implementation Guidance

Không nên bắt đầu bằng việc thêm feature mới. Sprint 1 nên tập trung vào:

1. Rút navigation.
2. Dọn sạch terminology.
3. Biến Overview thành decision inbox.
4. Thêm Decision Header cho detail.
5. Thêm safety/trust warnings.
6. Khóa data derivation cho portfolio impact/status/isWatched.

Đây là những thay đổi có impact lớn nhất tới clarity và trust, trong khi không bắt buộc backend phải thay đổi lớn ngay lập tức.
