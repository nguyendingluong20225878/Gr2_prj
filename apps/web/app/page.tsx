'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuth } from './contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, Zap } from 'lucide-react';

export default function LandingPage() {
  const { loading, setUser } = useAuth();
  const router = useRouter();

  const handleDevModeSkip = () => {
    // Create a mock user for development
    const mockUser: any = {
      _id: 'dev-user-123',
      email: 'dev@ndl.ai',
      name: 'Dev User',
      walletAddress: 'DevWallet123456789',
      riskTolerance: 'medium',
      tradeStyle: 'Swing Trading',
      totalAssetUsd: 50000,
      cryptoInvestmentUsd: 25000,
      image: '',
      notificationEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setUser(mockUser);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center">
      {/* Animated Background */}
      <div className="absolute inset-0 cyber-grid opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-cyan-500/20" />

      {/* Floating orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
      <div
        className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: '1000ms' }}
      />

      <div className="relative z-10 text-center px-4">
        <h1 className="text-7xl md:text-9xl lg:text-[12rem] font-bold gradient-text mb-12 leading-none tracking-tight">
          NDL AI
        </h1>

        <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-2xl mx-auto">
          AI-Powered Crypto Trading Signals on Solana
        </p>

        <div className="flex flex-col items-center gap-4">
          {loading ? (
            <div className="glass-card px-8 py-4 rounded-xl flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              <span className="text-slate-100">Connecting...</span>
            </div>
          ) : (
            <>
              <div className="glass-card p-2 rounded-xl hover:border-purple-500/50 transition-all">
                <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-cyan-500 hover:!opacity-90 !transition-all !px-8 !py-4 !text-lg !font-semibold !rounded-lg" />
              </div>

              <button
                onClick={handleDevModeSkip}
                className="glass-card border-cyan-500/30 hover:border-cyan-500 text-slate-300 hover:text-slate-100 transition-all px-6 py-3 rounded-lg flex items-center gap-2"
              >
                <Zap className="w-4 h-4 text-cyan-400" />
                Dev Mode - Skip to Dashboard
              </button>

              <p className="text-xs text-slate-500 max-w-xs mt-2">
                Click "Skip to Dashboard" to test the app without connecting wallet
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
