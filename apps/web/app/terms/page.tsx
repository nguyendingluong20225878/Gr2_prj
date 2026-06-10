import Link from 'next/link';
import { Activity, ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

const sections = [
  {
    title: '1. Pham vi dich vu',
    body: 'NDL cung cap dashboard DeFi, du lieu portfolio, signal, khuyen nghi va cac cong cu phan tich lien quan den tai san crypto tren Solana. Cac tinh nang trong san pham chi nham muc dich tham khao va ho tro ra quyet dinh.',
  },
  {
    title: '2. Khong phai loi khuyen tai chinh',
    body: 'Moi thong tin, signal, proposal, diem tin cay, mo phong loi nhuan hoac canh bao rui ro trong NDL khong phai loi khuyen dau tu, phap ly, thue hay tai chinh. Ban can tu danh gia va co the tham khao chuyen gia doc lap truoc khi ra quyet dinh.',
  },
  {
    title: '3. Rui ro tai san crypto',
    body: 'Crypto va DeFi co bien dong lon, co the mat mot phan hoac toan bo von. Gia, thanh khoan, slippage, phi mang, loi smart contract, loi du lieu va dieu kien thi truong co the lam ket qua thuc te khac voi uoc tinh trong ung dung.',
  },
  {
    title: '4. Trach nhiem cua nguoi dung',
    body: 'Ban chiu trach nhiem bao mat vi, khoa rieng, giao dich va moi quyet dinh dau tu cua minh. NDL khong bao dam loi nhuan, khong bao dam signal chinh xac tuyet doi va khong chiu trach nhiem cho thiet hai phat sinh tu viec su dung thong tin trong ung dung.',
  },
  {
    title: '5. Du lieu va tinh kha dung',
    body: 'NDL co the hien thi du lieu bi tre, thieu, sai lech hoac chua duoc cap nhat. Chung toi co the thay doi, tam dung hoac ngung mot phan dich vu khi can bao tri, nang cap hoac xu ly su co.',
  },
  {
    title: '6. Thay doi dieu khoan',
    body: 'Dieu khoan co the duoc cap nhat theo thoi gian. Viec tiep tuc su dung NDL sau khi dieu khoan duoc cap nhat dong nghia voi viec ban chap nhan phien ban moi.',
  },
];

export default function TermsPage() {
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
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Phap ly</p>
              <h1 className="text-3xl font-black gradient-text md:text-4xl">Dieu khoan su dung</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Cap nhat lan cuoi: 07/06/2026. Vui long doc ky truoc khi su dung NDL de theo doi portfolio, signal hoac khuyen nghi giao dich.
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100">
              <ShieldAlert className="mb-2 h-5 w-5 text-amber-300" />
              <p className="text-xs leading-5">Crypto co rui ro cao. NDL khong bao dam loi nhuan va khong thay the tu van tai chinh doc lap.</p>
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

          <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
            <Button asChild variant="outline" className="border-cyan-500/30 text-cyan-300">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Ve trang dang nhap
              </Link>
            </Button>
            <Button asChild variant="ghost" className="text-slate-300">
              <Link href="/privacy">Xem chinh sach bao mat</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
