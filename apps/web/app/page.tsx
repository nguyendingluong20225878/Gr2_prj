'use client';

import { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { useAuth } from './contexts/AuthContext';
import { Loader2, Zap } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { setUser, isAuthenticated } = useAuth();
  
  // State để quản lý trạng thái kiểm tra
  const [isVerifying, setIsVerifying] = useState(false);

  // LOGIC CHÍNH: Lắng nghe ví kết nối
  useEffect(() => {
    const checkWallet = async () => {
      // 1. Nếu chưa kết nối hoặc đang kiểm tra thì bỏ qua
      if (!connected || !publicKey || isVerifying || isAuthenticated) return;

      try {
        setIsVerifying(true);
        console.log("🔐 Checking wallet:", publicKey.toBase58());

        // 2. Gọi API kiểm tra ví trong Database
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
        });

        const data = await res.json();

        if (data.exists) {
          // TRƯỜNG HỢP 1: Đã có User -> Lưu vào Context -> Vào Dashboard
          console.log("✅ User found, redirecting to Dashboard...");
          setUser(data.user);
          router.push('/dashboard');
        } else {
          // TRƯỜNG HỢP 2: Chưa có User -> Sang trang nhập thông tin
          console.log("🆕 New wallet, redirecting to Onboarding...");
          // Lưu ý: Không lưu user vào context lúc này vì chưa có thông tin
          router.push('/onboarding');
        }
      } catch (error) {
        console.error("❌ Verification failed:", error);
      } finally {
        setIsVerifying(false);
      }
    };

    checkWallet();
  }, [connected, publicKey, isAuthenticated, router, setUser]); // Bỏ isVerifying ra khỏi dependency để tránh loop

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center">
      {/* Background Effects */}
      <div className="absolute inset-0 cyber-grid opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-cyan-500/20" />
      
      <div className="relative z-10 text-center px-4">
        <h1 className="text-7xl md:text-9xl font-bold gradient-text mb-8">
          NDL AI
        </h1>
        <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto">
          AI-Powered Crypto Trading Signals on Solana
        </p>

        <div className="flex flex-col items-center gap-4">
          {/* Hiển thị Loading khi đang check DB */}
          {isVerifying ? (
            <div className="glass-card px-8 py-4 rounded-xl flex items-center gap-3 border border-cyan-500/30">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              <span className="text-slate-100 font-medium">Checking Account...</span>
            </div>
          ) : (
            <div className="glass-card p-2 rounded-xl hover:border-purple-500/50 transition-all">
              {/* Nút Connect Ví của Solana */}
              <WalletMultiButton style={{
                  background: 'linear-gradient(to right, #a855f7, #06b6d4)',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  padding: '0 2rem',
                  height: '3.5rem'
              }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}