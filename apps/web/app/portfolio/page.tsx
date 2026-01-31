'use client';

import { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Loader2, RefreshCw, CheckCircle, Wallet } from 'lucide-react';
import { Portfolio as PortfolioDashboard } from '@/app/components/portfolio/Portfolio';
import { toast } from 'sonner';

export default function PortfolioPage() {
  const { user, setUser } = useAuth(); // Để update user balance sau khi sync
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  
  const [isSyncing, setIsSyncing] = useState(false);

  // --- LOGIC SYNC BALANCES TỪ BLOCKCHAIN ---
  const handleSyncBalances = async () => {
    if (!publicKey) return toast.error("Please connect your wallet first!");
    
    setIsSyncing(true);
    try {
      const balances: any[] = [];
      
      // 1. Quét SOL Balance
      const solBalance = await connection.getBalance(publicKey);
      balances.push({
        tokenAddress: "So11111111111111111111111111111111111111112", // Địa chỉ chuẩn của SOL
        balance: (solBalance / LAMPORTS_PER_SOL).toString(),
        updatedAt: new Date()
      });

      // 2. Quét SPL Tokens (USDC, JUP...)
      // Lưu ý: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA là Program ID của SPL Token
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      });

      tokenAccounts.value.forEach((account) => {
        const info = account.account.data.parsed.info;
        const amount = info.tokenAmount.uiAmountString;
        
        // Chỉ lấy token có số dư > 0
        if (parseFloat(amount) > 0) {
          balances.push({
            tokenAddress: info.mint,
            balance: amount,
            updatedAt: new Date()
          });
        }
      });

      console.log("Synced Balances:", balances);

      // 3. Gửi lên API để lưu vào MongoDB
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress: publicKey.toBase58(),
          balances: balances 
        }),
      });

      if (!res.ok) throw new Error('Failed to update database');
      
      const result = await res.json();
      
      // Cập nhật lại Context User để UI tự render lại
      if (result.user) {
        setUser(result.user);
      }
      
      toast.success(`Synced! Found ${balances.length} assets.`);
      
      // Reload trang để Portfolio component fetch lại data mới nhất từ API
      window.location.reload(); 

    } catch (err) {
      console.error("Sync Error:", err);
      toast.error("Failed to sync wallet balances.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f061e] via-[#1a0b2e] to-[#0f061e] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER: Title & Sync Button */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
           <div>
             <h1 className="text-4xl font-bold gradient-text">Portfolio Tracker</h1>
             <p className="text-slate-400 text-sm mt-1">Real-time asset tracking & performance</p>
           </div>

           {/* Nút Sync Balance xịn xò */}
           <button 
             onClick={handleSyncBalances}
             disabled={isSyncing}
             className="glass-card px-4 py-2 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400 transition-all flex items-center gap-2 text-sm font-bold shadow-lg shadow-cyan-900/20"
           >
             <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
             {isSyncing ? 'Scanning Blockchain...' : 'Sync Wallet Balances'}
           </button>
        </div>

        {/* COMPONENT DASHBOARD CHÍNH */}
        <PortfolioDashboard />
        
      </div>
    </div>
  );
}