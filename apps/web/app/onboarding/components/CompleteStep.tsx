'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';

export function CompleteStep() {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-green-500/30 bg-green-500/10 text-green-300">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h2 className="mt-5 text-2xl font-bold gradient-text">Hồ sơ đã sẵn sàng</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
        NDL đang mở dashboard để đồng bộ Portfolio và hiển thị signal phù hợp với hồ sơ của bạn.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-cyan-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang chuyển đến tổng quan...
      </div>
    </div>
  );
}
