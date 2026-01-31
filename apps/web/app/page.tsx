'use client';

import { useEffect, useRef } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from './contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function LandingPage() {
  const { connected, publicKey } = useWallet();
  const { verifyWallet, isAuthenticated, isLoading } = useAuth();
  
  // Dùng ref để tránh gọi verify 2 lần (React 18 Strict Mode hay bị double invoke)
  const hasVerified = useRef(false);

  useEffect(() => {
    // Chỉ chạy khi:
    // 1. Ví đã kết nối
    // 2. Có Public Key
    // 3. Chưa xác thực (isAuthenticated = false)
    // 4. Không đang trong quá trình loading
    if (connected && publicKey && !isAuthenticated && !isLoading) {
      if (!hasVerified.current) {
        hasVerified.current = true;
        verifyWallet(publicKey.toBase58());
      }
    }
    
    // Reset ref khi disconnect
    if (!connected) {
      hasVerified.current = false;
    }
  }, [connected, publicKey, isAuthenticated, isLoading, verifyWallet]);

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center">
      {/* Background Effects */}
      <div className="absolute inset-0 cyber-grid opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-cyan-500/20" />
      
      <div className="relative z-10 text-center px-4">
        <h1 className="text-7xl md:text-9xl font-bold gradient-text mb-8 animate-in fade-in zoom-in duration-1000">
          NDL AI
        </h1>
        <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-1000 delay-200">
          AI-Powered Crypto Trading Signals on Solana
        </p>

        <div className="flex flex-col items-center gap-4 animate-in slide-in-from-bottom-8 duration-1000 delay-300">
          {/* Hiển thị trạng thái Loading từ AuthContext */}
          {isLoading ? (
            <div className="glass-card px-8 py-4 rounded-xl flex items-center gap-3 border border-cyan-500/30">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              <span className="text-slate-100 font-medium">Checking Database...</span>
            </div>
          ) : (
            <div className="glass-card p-2 rounded-xl hover:border-purple-500/50 transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)]">
              {/* Nút Connect Ví */}
              <WalletMultiButton style={{
                  background: 'linear-gradient(to right, #a855f7, #06b6d4)',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  padding: '0 2rem',
                  height: '3.5rem'
              }} />
            </div>
          )}
          
          {!connected && !isLoading && (
            <p className="text-sm text-slate-500 mt-4">
              Connect your Solana wallet to verify access
            </p>
          )}
        </div>
      </div>
    </div>
  );
}