'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { Loader2, ShieldCheck, Wallet } from 'lucide-react';
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="absolute inset-0 cyber-grid opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/15 via-transparent to-cyan-500/15" />

      <section className="relative z-10 w-full max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
          <Wallet className="h-8 w-8" />
        </div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-cyan-400">Đăng nhập ví</p>
        <h1 className="text-6xl font-black gradient-text md:text-7xl">NDL</h1>
        <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-slate-300">
          Kết nối ví Solana để NDL đọc Portfolio, kiểm tra hồ sơ và cá nhân hóa Signal giao dịch.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          {isLoading ? (
            <div className="glass-card flex items-center gap-3 rounded-xl border border-cyan-500/30 px-8 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              <span className="font-medium text-slate-100">Đang kiểm tra hồ sơ...</span>
            </div>
          ) : (
            <div className="glass-card rounded-xl p-2 shadow-[0_0_20px_rgba(168,85,247,0.24)] transition-all hover:border-purple-500/50">
              <WalletMultiButton
                style={{
                  background: 'linear-gradient(to right, #a855f7, #06b6d4)',
                  borderRadius: '0.5rem',
                  fontWeight: 700,
                  height: '3.5rem',
                  padding: '0 2rem',
                }}
              />
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <ShieldCheck className="h-4 w-4 text-green-400" />
            {connected && publicKey ? (
              <span>Wallet Address: {publicKey.toBase58()}</span>
            ) : (
              <span>Kết nối ví để tiếp tục hoặc tạo hồ sơ mới.</span>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
