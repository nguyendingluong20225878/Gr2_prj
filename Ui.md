# UI Flow - Portfolio-first Recommendation

Tài liệu này mô tả lại luồng màn hình UI theo góp ý reviewer: người dùng cần đi từ **đang có tài sản gì** -> **nên làm gì** -> **vì sao** -> **được/mất gì**.

## 1. Functional Decomposition

```mermaid
flowchart TD
    A["Ứng dụng hỗ trợ quyết định đầu tư"] --> B["Portfolio"]
    A --> C["Recommendation"]
    A --> D["Signal Analysis"]
    A --> E["Strategy Simulation"]
    A --> F["Explainability"]
    A --> G["Position Monitoring"]

    B --> B1["Sync wallet"]
    B --> B2["Xem tài sản đang có"]
    B --> B3["Phân bổ vốn"]
    B --> B4["Tài sản ưu tiên phân tích"]

    C --> C1["Khuyến nghị theo tài sản đang có"]
    C --> C2["Cơ hội ngoài portfolio"]
    C --> C3["Top phù hợp với portfolio"]
    C --> C4["Next action: Hold / Buy / Wait / Reduce"]

    D --> D1["Signal score"]
    D --> D2["Z-score"]
    D --> D3["Confidence"]
    D --> D4["Backtest outcome"]
    D --> D5["Signal validity time"]

    E --> E1["Nếu giữ"]
    E --> E2["Nếu mua thêm"]
    E --> E3["Nếu bán một phần"]
    E --> E4["Expected upside / downside"]

    F --> F1["Giải thích bằng ngôn ngữ đơn giản"]
    F --> F2["Lý do định lượng"]
    F --> F3["Rủi ro"]
    F --> F4["Điều kiện làm khuyến nghị sai"]

    G --> G1["Open positions"]
    G --> G2["PnL / ROI"]
    G --> G3["Signal thay đổi"]
    G --> G4["Review / Close position"]
```

## 2. Main User Flow

```mermaid
flowchart LR
    S["Start"] --> P["Portfolio Overview"]
    P --> D["Portfolio Diagnosis"]
    D --> R["Recommended Actions"]
    R --> A{"Người dùng chọn hành động"}

    A -->|"Xem tài sản đang có"| H["Holding Detail"]
    A -->|"Xem cơ hội mới"| O["Opportunity Detail"]
    A -->|"Xem lý do"| X["Explanation View"]
    A -->|"Mô phỏng"| M["Strategy Simulation"]

    H --> T["Token Intelligence"]
    O --> T
    X --> T
    M --> Q["Proposal Detail"]
    T --> Q
    Q --> E{"Quyết định"}

    E -->|"Theo dõi"| W["Watchlist"]
    E -->|"Vào lệnh demo/thật"| POS["Positions"]
    E -->|"Chờ vùng giá"| AL["Alerts"]

    POS --> MON["Position Monitoring"]
    AL --> P
    W --> P
    MON --> P
```

## 3. Screen Flow Detail

```mermaid
flowchart TD
    P["Portfolio Overview Screen"] --> P1["Total net worth"]
    P --> P2["Holdings list"]
    P --> P3["Allocation by asset"]
    P --> P4["Owned asset priority"]
    P --> P5["Last synced at"]

    P --> D["Portfolio Diagnosis Screen"]
    D --> D1["Tài sản rủi ro nhất"]
    D --> D2["Tài sản có cơ hội nhất"]
    D --> D3["Tài sản đang thiếu tín hiệu"]
    D --> D4["Data freshness warning"]

    D --> R["Recommendation Screen"]
    R --> R1["Nhóm 1: tài sản bạn đang có"]
    R --> R2["Nhóm 2: cơ hội bổ sung"]
    R --> R3["Top 10 phù hợp"]
    R --> R4["Action label: Hold / Buy / Wait / Reduce"]

    R1 --> S1["Asset Strategy Card"]
    R2 --> S1
    R3 --> S1

    S1 --> S11["Ví dụ: Bạn đang có 1 SOL"]
    S1 --> S12["Chiến lược: giữ / chốt một phần / chờ mua thêm"]
    S1 --> S13["Entry zone"]
    S1 --> S14["Exit / stop condition"]
    S1 --> S15["Upside / downside"]

    S1 --> X["Explanation Drawer"]
    X --> X1["Kết luận ngắn"]
    X --> X2["Vì sao hệ thống gợi ý vậy"]
    X --> X3["Z-score nghĩa là gì"]
    X --> X4["3.41 khác 2.31 như thế nào"]
    X --> X5["Khi nào không nên tin tín hiệu"]

    S1 --> M["Simulation Screen"]
    M --> M1["Nếu hold"]
    M --> M2["Nếu buy thêm"]
    M --> M3["Nếu sell 20%"]
    M --> M4["Risk / reward comparison"]

    M --> Q["Proposal Detail Screen"]
    Q --> Q1["The Logic"]
    Q --> Q2["The Evidence"]
    Q --> Q3["The Numbers"]
    Q --> Q4["Risk Simulation"]
    Q --> Q5["Decision CTA"]
```

## 4. Simplified Wireframe Map

```mermaid
flowchart LR
    NAV["Sidebar / Navbar"] --> OV["Overview"]
    NAV --> PF["Portfolio"]
    NAV --> SG["Signals"]
    NAV --> PS["Positions"]
    NAV --> AL["Alerts"]

    OV["Overview mới"] --> OV1["Portfolio Snapshot"]
    OV --> OV2["Today Next Action"]
    OV --> OV3["Top Risk"]
    OV --> OV4["Top Opportunity"]

    PF["Portfolio"] --> PF1["Wallet Holdings"]
    PF --> PF2["Investments"]
    PF --> PF3["Watchlist"]
    PF --> PF4["Sync Wallet"]

    SG["Signals"] --> SG1["Signal Feed"]
    SG --> SG2["Heatmap"]
    SG --> SG3["Filters"]
    SG --> SG4["Score Explanation"]

    PS["Positions"] --> PS1["Open Positions"]
    PS --> PS2["PnL / ROI"]
    PS --> PS3["Signal Changed Warning"]
    PS --> PS4["Close / Review"]

    AL["Alerts"] --> AL1["Entry zone alerts"]
    AL --> AL2["Signal expiring soon"]
    AL --> AL3["Risk alerts"]
```

## 5. Recommended Overview Layout

```mermaid
flowchart TD
    A["Overview"] --> B["1. Portfolio Snapshot"]
    B --> B1["Bạn đang có gì?"]
    B --> B2["Tổng giá trị"]
    B --> B3["Top holdings"]
    B --> B4["Cập nhật lần cuối"]

    A --> C["2. Diagnosis"]
    C --> C1["Tài sản cần chú ý"]
    C --> C2["Rủi ro lớn nhất"]
    C --> C3["Cơ hội tốt nhất"]

    A --> D["3. Recommended Next Actions"]
    D --> D1["SOL: Hold, chờ mua thêm tại vùng X"]
    D --> D2["ADA: Chỉ mua nếu về vùng hỗ trợ"]
    D --> D3["BTC: Giữ làm tài sản ổn định"]

    A --> E["4. Why"]
    E --> E1["Lý do dễ hiểu"]
    E --> E2["Chỉ số hỗ trợ"]
    E --> E3["Cảnh báo nếu dữ liệu cũ"]

    A --> F["5. Deep Dive"]
    F --> F1["Mở Token Detail"]
    F --> F2["Mở Proposal Detail"]
    F --> F3["Mở Simulation"]
```

## 6. Data and Timing Consistency Flow

```mermaid
flowchart TD
    A["Wallet sync"] --> A1["Portfolio snapshot time"]
    B["Market data fetch"] --> B1["Price updated time"]
    C["Signal calculation"] --> C1["Signal calculated time"]
    D["Recommendation engine"] --> D1["Recommendation valid until"]

    A1 --> E{"Timestamp hợp lệ?"}
    B1 --> E
    C1 --> E
    D1 --> E

    E -->|"Có"| F["Hiển thị recommendation"]
    E -->|"Không"| G["Cảnh báo dữ liệu cũ"]
    G --> H["Yêu cầu refresh / không khuyến nghị hành động mạnh"]

    F --> I["Entry / exit zone"]
    F --> J["Expected outcome"]
    F --> K["Risk explanation"]
```

## 7. Production Priority

```mermaid
flowchart TD
    H["HIGH"] --> H1["Portfolio-first overview"]
    H --> H2["Ưu tiên asset người dùng đang có"]
    H --> H3["Actionable strategy card"]
    H --> H4["Explainability cho score/z-score"]
    H --> H5["Timestamp và signal validity"]

    M["MEDIUM"] --> M1["Entry zone cho từng token"]
    M --> M2["Top 10 phù hợp với portfolio"]
    M --> M3["Simple / Expert mode"]

    L["LOW"] --> L1["Visual polish"]
    L --> L2["Animation"]
    L --> L3["Advanced chart detail"]
```

