'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';

export function WalletDebug() {
  const wallet = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Log trạng thái ra console để tiện theo dõi
    console.log('🔌 Wallet State Update:', {
      connected: wallet.connected,
      connecting: wallet.connecting,
      disconnecting: wallet.disconnecting,
      publicKey: wallet.publicKey?.toBase58(),
      walletName: wallet.wallet?.adapter.name,
      readyState: wallet.wallet?.adapter.readyState,
    });
  }, [wallet.connected, wallet.connecting, wallet.publicKey, wallet.wallet]);

  // Không hiển thị gì nếu chưa mount (tránh lỗi hydration)
  if (!mounted) return null;

  // Ẩn khi build production (tùy chọn)
  // if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed bottom-4 right-4 glass-card p-4 rounded-lg text-xs max-w-xs z-50 shadow-2xl border border-white/10 bg-black/80 backdrop-blur-md">
      <h3 className="text-cyan-400 font-bold mb-2 flex items-center gap-2">
        🔧 Wallet Debug
      </h3>
      <div className="space-y-2 text-slate-300 font-mono">
        <div className="flex justify-between items-center border-b border-white/10 pb-1">
          <span>Status:</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            wallet.connected ? 'bg-green-500/20 text-green-400' : 
            wallet.connecting ? 'bg-yellow-500/20 text-yellow-400' : 
            'bg-red-500/20 text-red-400'
          }`}>
            {wallet.connected ? 'CONNECTED' : wallet.connecting ? 'CONNECTING...' : 'DISCONNECTED'}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span>Address:</span> 
          <span className="text-purple-300" title={wallet.publicKey?.toBase58()}>
            {wallet.publicKey 
              ? `${wallet.publicKey.toBase58().slice(0, 4)}...${wallet.publicKey.toBase58().slice(-4)}` 
              : 'None'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span>Adapter:</span>
          <span className="text-slate-400">{wallet.wallet?.adapter.name || 'None'}</span>
        </div>
      </div>
    </div>
  );
}