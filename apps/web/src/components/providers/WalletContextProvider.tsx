"use client";
/* Wallet context provider for Solana wallets (Phantom-only) */
import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
// Import default UI styles from wallet-adapter-react-ui
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("@solana/wallet-adapter-react-ui/styles.css");

type Props = {
  children: React.ReactNode;
};

export default function WalletContextProvider({ children }: Props) {
  const endpoint = "https://api.devnet.solana.com";

  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
