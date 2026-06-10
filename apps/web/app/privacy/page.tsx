import Link from 'next/link';
import { Activity, ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

const sections = [
  {
    title: '1. Du lieu chung toi co the thu thap',
    body: 'NDL co the xu ly dia chi vi, thong tin ho so do ban cung cap, so du token, lich su tuong tac trong ung dung, watchlist, proposal, trang thai onboarding va du lieu ky thuat can thiet de duy tri phien dang nhap.',
  },
  {
    title: '2. Muc dich su dung du lieu',
    body: 'Du lieu duoc dung de xac thuc vi, ca nhan hoa dashboard, tinh toan portfolio, hien thi signal lien quan, cai thien do tin cay cua khuyen nghi va van hanh cac tinh nang bao mat cua ung dung.',
  },
  {
    title: '3. Chia se du lieu',
    body: 'Chung toi khong ban du lieu ca nhan cua ban. Du lieu co the duoc xu ly boi cac dich vu ha tang, co so du lieu, API blockchain hoac nha cung cap phan tich can thiet de van hanh san pham.',
  },
  {
    title: '4. Bao mat',
    body: 'NDL ap dung cookie httpOnly cho session va cac bien phap hop ly de giam rui ro truy cap trai phep. Tuy nhien khong co he thong nao an toan tuyet doi, va ban van can tu bao ve vi cung thiet bi cua minh.',
  },
  {
    title: '5. Quyen cua ban',
    body: 'Ban co the yeu cau cap nhat, xoa hoac xem lai thong tin lien quan den ho so trong pham vi phap luat va kha nang ky thuat cho phep. Mot so du lieu giao dich on-chain co tinh cong khai va khong the xoa khoi blockchain.',
  },
  {
    title: '6. Cookies va session',
    body: 'NDL dung cookie session de ghi nho trang thai dang nhap bang vi. Cookie nay ho tro bao mat tai khoan va khong duoc thiet ke cho quang cao hanh vi.',
  },
  {
    title: '7. Thay doi chinh sach',
    body: 'Chinh sach bao mat co the duoc cap nhat khi san pham thay doi. Ngay cap nhat moi nhat se duoc hien thi tren trang nay.',
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="absolute inset-0 -z-0 cyber-grid opacity-10" />
      <div className="relative z-10 mx-auto max-w-4xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-3 text-slate-300 transition-colors hover:text-cyan-300">
          <span className="relative flex rounded-lg bg-gradient-purple-cyan p-2">
            <Activity className="h-5 w-5 text-white" />
          </span>
          <span>
            <span className="block text-lg font-bold gradient-text">NDL</span>
            <span className="block text-xs text-slate-500">Solana DeFi Dashboard</span>
          </span>
        </Link>

        <section className="glass-card rounded-2xl border border-white/10 bg-black/30 p-6 md:p-8">
          <div className="flex flex-col gap-5 border-b border-white/10 pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Bao mat</p>
              <h1 className="text-3xl font-black gradient-text md:text-4xl">Chinh sach bao mat</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Cap nhat lan cuoi: 07/06/2026. Trang nay mo ta cach NDL xu ly du lieu khi ban ket noi vi va su dung dashboard.
              </p>
            </div>
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-green-100">
              <ShieldCheck className="mb-2 h-5 w-5 text-green-300" />
              <p className="text-xs leading-5">Thong tin duoc dung de van hanh san pham, ca nhan hoa khuyen nghi va bao ve phien dang nhap.</p>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-bold text-white">{section.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-400">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
            <div className="flex flex-col gap-2 text-sm text-cyan-100 sm:flex-row sm:items-center">
              <Mail className="h-4 w-4 text-cyan-300" />
              <span>Lien he ve quyen rieng tu:</span>
              <a href="mailto:privacy@ndl.ai" className="font-semibold text-cyan-300 hover:underline">
                privacy@ndl.ai
              </a>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
            <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Ve trang dang nhap
              </Link>
            </Button>
            <Button asChild variant="ghost" className="text-slate-300">
              <Link href="/terms">Xem dieu khoan su dung</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
