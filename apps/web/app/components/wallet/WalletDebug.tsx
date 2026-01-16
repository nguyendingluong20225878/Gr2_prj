'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect } from 'react';
import { WalletReadyState } from '@solana/wallet-adapter-base';


export function WalletDebug() {
  const wallet = useWallet();

  useEffect(() => {
    console.log('🔌 Wallet State:', {
      connected: wallet.connected,
      connecting: wallet.connecting,
      disconnecting: wallet.disconnecting,
      publicKey: wallet.publicKey?.toBase58(),
      walletName: wallet.wallet?.adapter.name,
     readyState: wallet.wallet?.adapter.readyState,

    });
  }, [wallet.connected, wallet.connecting, wallet.publicKey, wallet.wallet]);

  return (
    <div className="fixed bottom-4 right-4 glass-card p-4 rounded-lg text-xs max-w-xs z-50">
      <h3 className="text-cyber-cyan font-semibold mb-2">🔍 Wallet Debug</h3>
      <div className="space-y-1 text-slate-300">
        <p>Connected: {wallet.connected ? '✅' : '❌'}</p>
        <p>Connecting: {wallet.connecting ? '⏳' : '❌'}</p>
        <p>PublicKey: {wallet.publicKey ? wallet.publicKey.toBase58().slice(0, 8) + '...' : 'None'}</p>
        <p>Wallet: {wallet.wallet?.adapter.name || 'None'}</p>
      </div>
    </div>
  );
}
