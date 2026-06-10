'use client';

import { ShieldCheck, Wallet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

export function WalletSummaryStep({
  walletAddress,
  onContinue,
}: {
  walletAddress: string;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
        <div className="flex items-start gap-3">
          <Wallet className="mt-1 h-5 w-5 shrink-0 text-cyan-300" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Ví đã kết nối</p>
            <p className="mt-1 truncate font-mono text-xs text-slate-400">{walletAddress}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <ShieldCheck className="mb-3 h-5 w-5 text-green-300" />
          <p className="text-sm font-bold text-white">Xác thực bằng ví</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">NDL dùng session ví hiện tại để tạo hồ sơ và chỉ đọc dữ liệu cần thiết cho danh mục.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <Wallet className="mb-3 h-5 w-5 text-purple-300" />
          <p className="text-sm font-bold text-white">Portfolio là trọng tâm</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Ứng dụng không thể tự thực hiện giao dịch nếu bạn chưa xác nhận bằng ví.</p>
        </div>
      </div>

      <Button type="button" onClick={onContinue} className="h-12 w-full rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 font-bold text-white">
        Tiếp tục tạo hồ sơ
      </Button>
    </div>
  );
}
