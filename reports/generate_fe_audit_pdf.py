from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)


ROOT = Path(__file__).resolve().parent
PDF_PATH = ROOT / "fe-audit-report.pdf"
FONT_REGULAR = Path("C:/Windows/Fonts/arial.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/arialbd.ttf")


def register_fonts():
    if FONT_REGULAR.exists() and FONT_BOLD.exists():
        pdfmetrics.registerFont(TTFont("DocFont", str(FONT_REGULAR)))
        pdfmetrics.registerFont(TTFont("DocFont-Bold", str(FONT_BOLD)))
        return "DocFont", "DocFont-Bold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD_NAME = register_fonts()


def esc(text):
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="TitleVi",
        fontName=FONT_BOLD_NAME,
        fontSize=23,
        leading=28,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="SubtitleVi",
        fontName=FONT,
        fontSize=11,
        leading=16,
        textColor=colors.HexColor("#475569"),
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        name="H2Vi",
        fontName=FONT_BOLD_NAME,
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=14,
        spaceAfter=7,
    )
)
styles.add(
    ParagraphStyle(
        name="H3Vi",
        fontName=FONT_BOLD_NAME,
        fontSize=11.5,
        leading=15,
        textColor=colors.HexColor("#155e75"),
        spaceBefore=9,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="BodyVi",
        fontName=FONT,
        fontSize=9.4,
        leading=13.5,
        textColor=colors.HexColor("#111827"),
        alignment=TA_LEFT,
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        name="SmallVi",
        fontName=FONT,
        fontSize=8.3,
        leading=11.5,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="BulletVi",
        parent=styles["BodyVi"],
        leftIndent=10,
        firstLineIndent=-7,
        bulletIndent=0,
    )
)
styles.add(
    ParagraphStyle(
        name="TableVi",
        fontName=FONT,
        fontSize=7.6,
        leading=10,
        textColor=colors.HexColor("#111827"),
    )
)
styles.add(
    ParagraphStyle(
        name="TableHeadVi",
        fontName=FONT_BOLD_NAME,
        fontSize=7.8,
        leading=10,
        textColor=colors.HexColor("#0f172a"),
    )
)


def p(text, style="BodyVi"):
    return Paragraph(text, styles[style])


def code(text):
    return f'<font name="{FONT_BOLD_NAME}" color="#0f172a">{esc(text)}</font>'


def bullet(text):
    return Paragraph(f"• {text}", styles["BulletVi"])


def table(rows, widths):
    converted = []
    for idx, row in enumerate(rows):
        style = "TableHeadVi" if idx == 0 else "TableVi"
        converted.append([Paragraph(str(cell), styles[style]) for cell in row])
    t = Table(converted, colWidths=widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf7fb")),
                ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#d9e0ea")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return t


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT, 8)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(16 * mm, 9 * mm, "Báo cáo audit Frontend GR2/NDL")
    canvas.drawRightString(194 * mm, 9 * mm, f"Trang {doc.page}")
    canvas.restoreState()


story = []

story.append(p("Frontend Audit Report", "SmallVi"))
story.append(p("Báo cáo trạng thái FE hiện tại của GR2/NDL", "TitleVi"))
story.append(
    p(
        f"Báo cáo này dựa trên việc đọc trực tiếp code trong {code('apps/web')}, tập trung vào cấu trúc frontend, routing, layout, component, luồng người dùng, data fetching, UX/UI, maintainability và các hạng mục cần cải tiến.",
        "SubtitleVi",
    )
)
story.append(
    table(
        [
            ["Ngày lập", "Phạm vi", "Vai trò review"],
            ["2026-06-14", "apps/web", "Senior FE / Product UI"],
        ],
        [48 * mm, 52 * mm, 68 * mm],
    )
)
story.append(Spacer(1, 7))

story.append(p("1. Tổng quan công nghệ", "H2Vi"))
story.append(
    p(
        "Frontend hiện là ứng dụng Next.js 14 App Router, dùng React 18, TypeScript, Tailwind CSS, Radix/shadcn-like UI components, SWR, Recharts, Sonner và Solana wallet adapter."
    )
)
for item in [
    f"Package frontend: {code('apps/web/package.json')}.",
    f"Root app layout: {code('apps/web/app/layout.tsx')}.",
    f"Theme/design token chính: {code('apps/web/app/globals.css')}, {code('apps/web/tailwind.config.ts')}.",
    f"Shared UI: {code('apps/web/app/components/shared/NdlUi.tsx')}, {code('apps/web/app/components/ui/*')}.",
    f"Data hooks: {code('apps/web/lib/hooks/useNdlData.ts')}, {code('useProposals.ts')}, {code('useSignals.ts')}, {code('usePortfolio.ts')}.",
    f"API routes trong cùng Next app: {code('apps/web/app/api/*')}.",
]:
    story.append(bullet(item))
story.append(
    p(
        "Nhận định nhanh: FE đã vượt mức prototype đơn giản. Sản phẩm đã có luồng ví, onboarding, dashboard, recommendation center, portfolio, watchlist, proposal detail, explanation, trade demo và trust/diagnostics. Tuy nhiên code đang nặng theo hướng page-level implementation, nhiều logic domain/UI lặp giữa các page."
    )
)

story.append(p("2. Routing và màn hình hiện có", "H2Vi"))
story.append(
    table(
        [
            ["Route", "File", "Chức năng hiện có", "Trạng thái"],
            ["/", "app/page.tsx", "Trang connect ví Solana, tự verify signature, điều hướng sang onboarding hoặc overview.", "Khá hoàn chỉnh."],
            ["/onboarding", "app/onboarding/page.tsx", "Wizard 3 bước: ví, hồ sơ, hoàn tất. Gọi /api/user/create.", "Dùng được, validation còn cơ bản."],
            ["/overview", "app/overview/page.tsx", "Dashboard chính: tổng giá trị danh mục, khuyến nghị cần xử lý, rủi ro dữ liệu, tín hiệu sắp hết hạn, holding snapshot, open positions, cross-impact.", "Giàu chức năng nhưng file quá lớn."],
            ["/recommendations", "app/recommendations/page.tsx", "Trung tâm khuyến nghị với tab, filter token/action/risk/confidence/expiry/data, watch proposal.", "Tốt, logic priority/filter nên tách."],
            ["/portfolio", "app/portfolio/page.tsx", "Đồng bộ ví Solana, hiển thị holdings, thiếu giá, khuyến nghị trực tiếp/gián tiếp.", "Tốt, có rủi ro UX nếu sync lỗi network/wallet."],
            ["/watchlist", "app/watchlist/page.tsx", "Danh sách proposal đang theo dõi, nhóm pending/verified/expired, xóa watchlist optimistic.", "Khá tốt."],
            ["/positions", "app/positions/page.tsx", "Danh sách vị thế mô phỏng đang mở, metric quy mô, Long/Short, ROI.", "Cần copy rõ paper trading hơn."],
            ["/proposal/[id]", "app/proposal/[id]/page.tsx", "Chi tiết khuyến nghị, confidence/quant drawer, timeline/backtest chart, quyết định wait/reject, trade prep.", "Rất giàu, nhưng quá dài và khó maintain."],
            ["/proposal/[id]/trade", "app/proposal/[id]/trade/page.tsx", "Preview risk, amount/leverage, execute demo trade qua API.", "Guard tốt, wording cần sửa."],
            ["/data-check, /diagnostics, /model-health", "app/data-check/page.tsx, app/diagnostics/page.tsx", "Trust center, kiểm tra freshness, dữ liệu thiếu, sức khỏe hệ thống/model.", "Hữu ích cho power user."],
        ],
        [25 * mm, 38 * mm, 75 * mm, 30 * mm],
    )
)

story.append(p("3. Luồng người dùng đã hỗ trợ", "H2Vi"))
for item in [
    "Kết nối ví và đăng nhập: người dùng dùng WalletMultiButton, ký message, API verify session qua /api/auth/nonce và /api/auth/verify.",
    "Tạo hồ sơ: onboarding gửi name/email/age/riskTolerance/tradeStyle tới /api/user/create.",
    "Đọc danh mục: portfolio page lấy SOL/token accounts qua Solana connection rồi PATCH profile balances.",
    "Xem khuyến nghị: overview/recommendations lấy proposal, portfolio, watchlist, cross impacts qua SWR.",
    "Theo dõi khuyến nghị: user có thể thêm/xóa watchlist qua /api/watchlist.",
    "Đọc giải thích: proposal detail có confidence/quant explanation, timeline, backtest visualization.",
    "Paper trading: trade page preview risk rồi gọi /api/trade/execute, backend tạo execution/position trạng thái demo.",
]:
    story.append(bullet(esc(item)))

story.append(p("4. State management và data fetching", "H2Vi"))
story.append(p("Điểm đang làm tốt", "H3Vi"))
for item in [
    "useNdlData.ts gom nhiều SWR resource: portfolio, proposals, signals, modelHealth, watchlist, crossImpacts.",
    "Refresh interval và deduping interval đã được đặt tương đối hợp lý cho dữ liệu động.",
    "Auth/session tách riêng ở AuthContext.tsx.",
    "Trading demo local state có provider riêng ở TradingDemoContext.tsx, lưu theo wallet scope trong localStorage.",
]:
    story.append(bullet(esc(item)))
story.append(p("Vấn đề", "H3Vi"))
for item in [
    "apiClient.ts có Axios interceptor nhưng phần lớn app vẫn gọi fetch('/api/...') trực tiếp. Đây là abstraction chưa được dùng nhất quán.",
    "useNdlData luôn fetch /api/portfolio dù có thể chưa có wallet/session. Điều này dễ gây 401 noise và empty/error state không cần thiết.",
    "Mutation logic rải trong page: watchlist ở overview/recommendations/proposal detail, trade decision ở proposal/trade, user profile sync ở portfolio.",
    "Type API đang khai báo nhiều ngay trong hook. Khi API contract đổi, FE dễ lệch nếu không có schema chung.",
]:
    story.append(bullet(esc(item)))

story.append(p("5. UI/UX và design system", "H2Vi"))
story.append(p("Điểm mạnh", "H3Vi"))
for item in [
    "Có shared UI khá hữu ích: PageHeader, MetricCard, DataSkeleton, EmptyState, ProposalCard, SignalCard.",
    "Mobile navigation có MobileBottomNav, tablet/desktop nav có responsive fallback.",
    "Copy tiếng Việt khá rõ về rủi ro dữ liệu, thiếu giá, tín hiệu hết hạn, disclaimer tài chính.",
    "Các màn hình nghiệp vụ có nhiều empty/loading states, không chỉ render bảng trống.",
]:
    story.append(bullet(esc(item)))
story.append(p("Điểm cần cải thiện", "H3Vi"))
for item in [
    "Visual theme trong globals.css thiên mạnh về cyberpunk/glassmorphism, purple/cyan gradient, blur/glow. Với dashboard tài chính, phong cách này đẹp nhưng có thể giảm khả năng scan số liệu.",
    "Nhiều card lồng nhau và border/glass lặp khiến information density chưa tối ưu.",
    "Wording trade cần cực kỳ rõ: backend đang tạo DEMO_FILLED, nhưng CTA vẫn là “Xác nhận vào lệnh”.",
    "Filter dùng native select ổn, nhưng thiếu summary chips để user nhìn nhanh filter đang bật.",
    "User menu có button “Cài đặt” disabled vì route chưa có; nên hoặc tạo route settings, hoặc ẩn mục này.",
]:
    story.append(bullet(esc(item)))

story.append(p("6. Maintainability và duplication", "H2Vi"))
story.append(p("Các file đang ôm quá nhiều trách nhiệm:"))
for item in [
    "app/overview/page.tsx: dashboard + sorting + priority score + nhiều component con + watch mutation.",
    "app/proposal/[id]/page.tsx: detail page + explanation drawer + chart section + advanced sections + helper formatting.",
    "app/portfolio/page.tsx: wallet sync + holding insights + recommendation cards + risk badges.",
    "app/recommendations/page.tsx: filter URL state + tab logic + priority score + mutation.",
]:
    story.append(bullet(esc(item)))
story.append(p("Logic nên tách dùng chung:"))
for item in [
    "RiskBadge, action badge class, status badge, mini stat/card.",
    "Priority score cho recommendation.",
    "Watchlist mutation helper.",
    "Proposal/actionability guard.",
    "Format/label cho paper trading/demo status.",
]:
    story.append(bullet(esc(item)))

story.append(p("7. Rủi ro kỹ thuật và UX", "H2Vi"))
for item in [
    "Rủi ro lớn nhất: UX giao dịch mô phỏng chưa được dán nhãn đủ mạnh ở mọi điểm hành động. Vì đây là sản phẩm tài chính/crypto, cần tránh mọi hiểu nhầm rằng hệ thống đang đặt lệnh thật.",
    "Không thấy test/spec riêng trong apps/web, trong khi app có nhiều logic tài chính và auth/session.",
    "Private routes dựa nhiều vào API/context, chưa thấy middleware hoặc protected layout rõ ràng.",
    "Portfolio API có nhiều I/O trong route handler và log wallet address; cần xem lại logging/privacy.",
    "Domain status còn pha nhiều biến thể: pending, active, ACTIVE, EXECUTED, PENDING. FE đang phải normalize nhiều.",
    "Data layer không thống nhất giữa SWR fetcher, raw fetch và Axios client.",
]:
    story.append(bullet(esc(item)))

story.append(PageBreak())
story.append(p("8. Danh sách đề xuất ưu tiên", "H2Vi"))
story.append(
    table(
        [
            ["Ưu tiên", "Vấn đề hiện tại", "Vì sao", "Nên sửa ở đâu", "Cách triển khai", "Effort"],
            ["P0", "Copy “Xác nhận vào lệnh” dễ bị hiểu là giao dịch thật, trong khi backend tạo DEMO_FILLED.", "Rủi ro UX cao trong sản phẩm tài chính.", "proposal/[id]/trade/page.tsx; api/trade/execute/route.ts; positions/page.tsx", "Đổi CTA thành “Xác nhận mô phỏng”, thêm banner paper trading cố định, đổi toast/status copy nhất quán.", "S"],
            ["P0", "Chưa thấy test FE trong apps/web.", "Luồng ví, watchlist, proposal, trade demo có rủi ro regression cao.", "apps/web/package.json, thư mục test mới.", "Thêm Vitest cho utils/hooks và Playwright smoke cho login/onboarding/recommendation/trade demo.", "M"],
            ["P1", "Data fetching/mutation không thống nhất.", "Khó chuẩn hóa auth, error, retry, optimistic update.", "useNdlData.ts, apiClient.ts, các page gọi fetch trực tiếp.", "Chọn một hướng: SWR fetcher chuẩn + mutation helpers, hoặc dùng Axios client thật sự. Xóa abstraction không dùng.", "M"],
            ["P1", "useNdlData fetch private data ngay cả khi chưa có ví/session.", "Giảm 401 noise và tránh state lỗi không cần thiết.", "apps/web/lib/hooks/useNdlData.ts.", "Dùng SWR key conditional: walletAddress ? '/api/portfolio' : null; tách public/private hooks.", "S"],
            ["P1", "Page quá lớn, ôm nhiều component/helper/domain logic.", "Khó review, khó test, dễ lặp bug.", "overview/page.tsx, proposal/[id]/page.tsx, portfolio/page.tsx.", "Tách theo feature: features/recommendations, features/portfolio, features/proposal-detail.", "M/L"],
            ["P1", "Priority score, risk badge, action badge, mini stat bị lặp.", "Giữ consistency giữa overview, portfolio, recommendations, proposal detail.", "NdlUi.tsx, các page sản phẩm.", "Tạo shared components/helper: RecommendationBadge, RiskBadge, MiniStat, getRecommendationPriorityScore.", "M"],
            ["P2", "Theme cyberpunk/glass hơi nặng cho dashboard nghiệp vụ.", "Dashboard tài chính cần scan nhanh, ít nhiễu thị giác.", "globals.css, Layout.tsx.", "Giữ accent cyan/purple nhưng giảm blur/glow/nền động, tăng contrast số liệu, dùng layout dense hơn.", "M"],
            ["P2", "Route protection chưa rõ ràng ở layout/middleware.", "Private page nên có hành vi nhất quán khi chưa auth.", "AuthContext.tsx, các route private.", "Thêm ProtectedLayout hoặc middleware mềm cho overview, portfolio, proposal, positions.", "M"],
            ["P2", "Onboarding validation còn cơ bản.", "Form lỗi cần feedback inline thay vì chỉ toast.", "onboarding/page.tsx, userInput.ts.", "Dùng schema chung, inline errors, disable submit khi invalid.", "S/M"],
            ["P3", "/signals redirect sang recommendations.", "Có thể lệch expectation nếu user nghĩ đây là màn signals riêng.", "signals/page.tsx, nav items.", "Hoặc bỏ route khỏi nav/entry, hoặc làm trang signals đúng nghĩa.", "S"],
        ],
        [14 * mm, 34 * mm, 28 * mm, 34 * mm, 46 * mm, 12 * mm],
    )
)

story.append(p("9. Roadmap ngắn hạn", "H2Vi"))
story.append(p("Việc nên làm ngay", "H3Vi"))
for item in [
    "Sửa wording toàn bộ paper trading/demo: CTA, toast, status badge, empty state, positions.",
    "Chặn fetch private data khi chưa có wallet/session.",
    "Chuẩn hóa watchlist/trade decision mutation helper.",
    "Thêm smoke tests cho flow chính.",
]:
    story.append(bullet(esc(item)))
story.append(p("Việc nên làm tiếp theo", "H3Vi"))
for item in [
    "Tách component/domain logic khỏi các page lớn.",
    "Hợp nhất badge/priority score/card UI.",
    "Dọn apiClient: dùng thật sự hoặc loại bỏ để tránh hai data-client song song.",
    "Thêm route guard/protected layout cho private app shell.",
]:
    story.append(bullet(esc(item)))
story.append(p("Việc có thể để sau", "H3Vi"))
for item in [
    "Polish visual system theo hướng dashboard tài chính ít nhiễu hơn.",
    "Mở rộng accessibility audit bằng keyboard/focus/ARIA.",
    "Chuẩn hóa domain status ở API để FE bớt normalize nhiều biến thể.",
]:
    story.append(bullet(esc(item)))

story.append(p("10. Kết luận", "H2Vi"))
story.append(
    p(
        "FE hiện đã có nền sản phẩm tương đối đầy đủ và có ý thức tốt về explainability, data quality, rủi ro và workflow ra quyết định. Phần cần ưu tiên không phải thêm màn hình mới, mà là làm chắc: wording paper trading, data layer nhất quán, test coverage, route protection và tách logic khỏi các page lớn. Sau khi xử lý nhóm P0/P1, app sẽ dễ mở rộng và đáng tin hơn nhiều."
    )
)
story.append(
    p(
        "Ghi chú: Audit này dựa trên code đọc được trong repository hiện tại. Một số route như model-health, alerts, tokens/[symbol], profile có được nhận diện trong cấu trúc route nhưng không mở toàn bộ chi tiết vì báo cáo tập trung vào các luồng FE trọng tâm.",
        "SmallVi",
    )
)


doc = SimpleDocTemplate(
    str(PDF_PATH),
    pagesize=A4,
    rightMargin=16 * mm,
    leftMargin=16 * mm,
    topMargin=16 * mm,
    bottomMargin=16 * mm,
    title="Báo cáo audit Frontend GR2/NDL",
    author="Codex",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(PDF_PATH)
