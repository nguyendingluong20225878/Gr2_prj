'use client';

import { FC, ReactNode, useMemo, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Import CSS cho ví
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({ children }) => {
  const network = WalletAdapterNetwork.Devnet;

  // Endpoint RPC
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  // State kiểm soát việc mount component để tránh lỗi Hydration của Next.js
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const wallets = useMemo(
    () => {
      // Trả về mảng rỗng khi đang render phía server
      if (!mounted) {
        return [];
      }

      try {
        // Chỉ khởi tạo Adapter phía Client
        return [new PhantomWalletAdapter()];
      } catch (error) {
        console.warn('Wallet adapter initialization error:', error);
        return [];
      }
    },
    [mounted]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      {/* Tắt autoConnect để tránh lỗi vòng lặp kết nối */}
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};