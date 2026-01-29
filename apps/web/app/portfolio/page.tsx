'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
  Loader2, Save, CheckCircle, User as UserIcon, 
  Wallet, Mail, Bell, RefreshCw 
} from 'lucide-react';

export default function ProfilePage() {
  const { user, setUser, isAuthenticated, isLoading } = useAuth();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const router = useRouter();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
    riskTolerance: 'medium',
    tradeStyle: 'swing',
    notificationEnabled: true
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/');
    
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        age: user.age ? String(user.age) : '',
        riskTolerance: user.riskTolerance || 'medium',
        tradeStyle: user.tradeStyle || 'swing',
        notificationEnabled: user.notificationEnabled ?? true
      });
    }
  }, [user, isAuthenticated, isLoading, router]);

  /**
   * Logic quét số dư thật từ Blockchain Solana (Client-side)
   */
  const handleSyncBalances = async () => {
    if (!publicKey) return alert("Please connect your wallet first!");
    setIsSyncing(true);
    try {
      const balances: any[] = [];
      
      // 1. Quét SOL
      const solBalance = await connection.getBalance(publicKey);
      balances.push({
        tokenAddress: "So11111111111111111111111111111111111111112",
        balance: (solBalance / LAMPORTS_PER_SOL).toString(),
        updatedAt: new Date()
      });

      // 2. Quét SPL Tokens (JUP, USDC,...)
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

      // 3. Gửi PATCH để cập nhật đồng thời cả profile và balances
      await updateProfile({ balances });
      setSuccessMsg('Wallet balances synced with Blockchain!');
    } catch (err) {
      console.error("Sync Error:", err);
      alert("Failed to sync balances.");
    } finally {
      setIsSyncing(false);
    }
  };

  const updateProfile = async (additionalData = {}) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const payload = {
        walletAddress: user.walletAddress,
        name: formData.name,
        email: formData.email,
        age: Number(formData.age),
        riskTolerance: formData.riskTolerance,
        tradeStyle: formData.tradeStyle,
        notificationEnabled: formData.notificationEnabled,
        ...additionalData
      };

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Update failed');

      setUser(result.user);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error("Save Error:", error);
      alert("Failed to save profile settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !user) return <div className="min-h-screen bg-[#0f061e] flex items-center justify-center"><Loader2 className="animate-spin text-purple-500" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f061e] via-[#1a0b2e] to-[#0f061e] p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold gradient-text">Profile Settings</h1>
        
        <div className="glass-card p-8 rounded-xl border border-white/5">
          <div className="space-y-8">
            
            {/* Wallet Section with Sync Button */}
            <div className="p-4 bg-white/5 rounded-lg border border-white/10 flex items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                 <div className="p-3 bg-purple-500/20 rounded-full text-purple-400"><Wallet size={24} /></div>
                 <div className="overflow-hidden">
                   <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Connected Wallet</label>
                   <div className="font-mono text-slate-200 text-sm md:text-base truncate">{user.walletAddress}</div>
                 </div>
               </div>
               
               <button 
                onClick={handleSyncBalances}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-all border border-cyan-500/30 text-sm font-bold"
               >
                 <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                 {isSyncing ? 'Syncing...' : 'Sync Balances'}
               </button>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Display Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3.5 text-slate-500 w-4 h-4" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 text-slate-500 w-4 h-4" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <label className="block text-sm text-slate-400 mb-2">Risk Tolerance</label>
                  <select 
                    value={formData.riskTolerance}
                    onChange={(e) => setFormData({...formData, riskTolerance: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500"
                  >
                    <option value="low">Low (Safety First)</option>
                    <option value="medium">Medium (Balanced)</option>
                    <option value="high">High (Degen Mode)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Trading Style</label>
                  <select 
                    value={formData.tradeStyle}
                    onChange={(e) => setFormData({...formData, tradeStyle: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500"
                  >
                    <option value="scalp">Scalping</option>
                    <option value="day">Day Trading</option>
                    <option value="swing">Swing Trading</option>
                  </select>
                </div>
            </div>

            <button 
              onClick={() => updateProfile()}
              disabled={isSaving}
              className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 py-4 rounded-lg font-bold text-white flex justify-center items-center gap-2"
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            
            {successMsg && (
              <p className="text-center text-green-400 text-sm flex items-center justify-center gap-2"><CheckCircle size={16}/>{successMsg}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}