import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useState } from 'react';

export function useWalletSync() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [isSyncing, setIsSyncing] = useState(false);

  const syncBalances = async () => {
    if (!publicKey) return;
    setIsSyncing(true);

    try {
      const balances = [];

      // 1. Lấy số dư SOL
      const solBalance = await connection.getBalance(publicKey);
      balances.push({
        tokenAddress: "So11111111111111111111111111111111111111112",
        balance: (solBalance / LAMPORTS_PER_SOL).toString(),
        updatedAt: new Date()
      });

      // 2. Lấy số dư SPL Tokens (JUP, USDC...)
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      });

      tokenAccounts.value.forEach((account) => {
        const info = account.account.data.parsed.info;
        const amount = info.tokenAmount.uiAmountString;
        if (parseFloat(amount) > 0) {
          balances.push({
            tokenAddress: info.mint,
            balance: amount,
            updatedAt: new Date()
          });
        }
      });

      // 3. Gửi lên API để cập nhật Database
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          balances: balances // Gửi mảng balances thật về server
        }),
      });

      if (!res.ok) throw new Error('Failed to sync to DB');
      
      return await res.json();
    } catch (error) {
      console.error("Sync failed:", error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  return { syncBalances, isSyncing };
}