'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { Loader2 } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';

export default function WalletLoginPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { user, verifyWallet, isAuthenticated, isLoading } = useAuth();
  const hasVerified = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user || isLoading) return;

    if (user.name && user.riskTolerance) {
      router.replace('/overview');
      return;
    }

    router.replace('/onboarding');
  }, [isAuthenticated, isLoading, router, user]);

  useEffect(() => {
    if (connected && publicKey && !isAuthenticated && !isLoading && !hasVerified.current) {
      hasVerified.current = true;
      void verifyWallet(publicKey.toBase58()).catch(() => {
        hasVerified.current = false;
      });
    }
    if (!connected) hasVerified.current = false;
  }, [connected, publicKey, isAuthenticated, isLoading, verifyWallet]);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="absolute inset-0 cyber-grid opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-cyan-500/20" />

      <section className="relative z-10 px-4 text-center">
        <h1 className="mb-8 animate-in fade-in zoom-in text-7xl font-bold gradient-text duration-1000 md:text-9xl">
          NDL
        </h1>
        <p className="mx-auto mb-12 max-w-2xl animate-in slide-in-from-bottom-4 text-xl text-slate-300 duration-1000">
          Trợ lý quyết định crypto cá nhân cho danh mục Solana của bạn
        </p>

        <div className="flex flex-col items-center gap-4 animate-in slide-in-from-bottom-8 duration-1000">
          {isLoading ? (
            <div className="glass-card flex items-center gap-3 rounded-xl border border-cyan-500/30 px-8 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              <span className="font-medium text-slate-100">Đang kiểm tra hồ sơ...</span>
            </div>
          ) : (
            <div className="glass-card rounded-xl p-2 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:border-purple-500/50">
              <WalletMultiButton
                style={{
                  background: 'linear-gradient(to right, #a855f7, #06b6d4)',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  height: '3.5rem',
                  padding: '0 2rem',
                }}
              />
            </div>
          )}

          {!connected && !isLoading ? (
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-500">
              Kết nối ví để NDL đọc danh mục và cá nhân hóa khuyến nghị. Ứng dụng không thể tự thực hiện giao dịch nếu bạn chưa xác nhận.
            </p>
          ) : null}
          {connected && publicKey ? (
            <p className="max-w-full truncate text-sm text-slate-500">Ví đã kết nối: {publicKey.toBase58()}</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
