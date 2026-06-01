### 1. Mục đích thư mục

`components` chứa UI building blocks và feature components cho analytics, proposal detail, portfolio, wallet, layout.

### 2. Thành phần bên trong

- `analytics`: `RegimeStatus`, `SignalLeaderboard`, `SignalHeatmap`, `TokenMomentumTable`, `AIInsightPanel`, `ExplainabilityDrawer`, `decisionState`.
- `proposal`: `ProposalDetailSocial`, `RiskSimulation`, `TheEvidence`, `TheLogic`, `TheNumbers`.
- `layout`: `Layout`, `Navbar`.
- `wallet`: Solana wallet connect/debug/provider components.
- `ui`: button, badge, input, label, skeleton, slider, sonner, tabs.
- `landing`, `onboarding`, `portfolio`: feature surfaces.

### 3. Luồng hoạt động

Pages truyền analytics rows/proposal data vào components. Components chỉ nên render và emit action callbacks, nhưng `ProposalDetailSocial` tự fetch detail, gọi decision/trade APIs, và kết nối wallet, nên nó vừa là smart component vừa là view.

### 4. Dependency

React client components, Tailwind, lucide, Recharts, Solana wallet adapter, local hooks/context.

### 5. Logic quan trọng

`decisionState.ts` gom quyết định UI thành `ready/conflict/risk/wait`. Analytics components hiển thị score, confidence, backtest, health, sentiment uncertainty, and true volatility when available. Proposal detail tính risk sizing và hiển thị execution CTA. `volatilityFlag` is treated only as a backward-compatible uncertainty alias.

### 6. Rủi ro / vấn đề

- `ProposalDetailSocial` rất lớn và nhiều trách nhiệm: fetch, normalize, chart data, risk, wallet, mutation.
- Một số UI copy mô tả tính năng trong app khá dài; dashboard operational có nguy cơ overload.
- Styling có nhiều `rounded-xl`/glass-card; nếu cần theo guideline enterprise, nên giảm decoration/card nesting.

### 7. Cách cải thiện

Tách proposal detail thành hooks (`useProposalDetail`, `useDecisionAudit`, `useTradeExecution`) và presentational sections. Viết test cho `decisionState` và risk sizing.
