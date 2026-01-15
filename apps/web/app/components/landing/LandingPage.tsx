'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuth } from '@/app/contexts/AuthContext';
import { WalletDebug } from '@/app/components/wallet/WalletDebug';
import { useRouter } from 'next/navigation';
import { Loader2, Zap } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

export function LandingPage() {
  const { loading, setUser } = useAuth();
  const router = useRouter();

  const handleDevModeSkip = () => {
    // Create a mock user for development
    const mockUser = {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setUser(mockUser);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-br from-cyber-purple/20 via-transparent to-cyber-cyan/20" />
      
      {/* Floating orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-cyber-purple/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyber-cyan/20 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="relative z-10 text-center">
        {/* Giant NDL Text */}
        <h1 className="text-9xl md:text-[12rem] lg:text-[16rem] font-bold bg-gradient-to-r from-cyber-purple to-cyber-cyan bg-clip-text text-transparent mb-12 leading-none tracking-tight">
          NDL
        </h1>
        
        {/* Connect Wallet Button */}
        <div className="flex flex-col items-center gap-4">
          {loading ? (
            <div className="glass-card px-8 py-4 rounded-xl flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-cyber-cyan" />
              <span className="text-slate-100">Connecting...</span>
            </div>
          ) : (
            <>
              <div className="glass-card p-2 rounded-xl hover:border-cyber-purple/50 transition-all">
                <WalletMultiButton className="!bg-gradient-to-r !from-cyber-purple !to-cyber-cyan hover:!opacity-90 !transition-all !px-8 !py-4 !text-lg !font-semibold !rounded-lg" />
              </div>
              
              {/* Dev Mode Skip Button */}
              <Button
                onClick={handleDevModeSkip}
                variant="outline"
                className="glass-card border-cyber-cyan/30 hover:border-cyber-cyan text-slate-300 hover:text-slate-100 transition-all px-6 py-3"
              >
                <Zap className="w-4 h-4 mr-2 text-cyber-cyan" />
                Dev Mode - Skip to Dashboard
              </Button>
              
              <p className="text-xs text-slate-500 max-w-xs mt-2">
                Click "Skip to Dashboard" to test the app without connecting wallet
              </p>
            </>
          )}
        </div>
      </div>
      
      {/* Debug Panel */}
      <WalletDebug />
    </div>
  );
}
