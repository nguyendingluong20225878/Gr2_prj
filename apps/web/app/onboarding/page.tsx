'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { Loader2, ArrowRight, Wallet, Mail, User, TrendingUp } from 'lucide-react';

export default function Onboarding() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const { setUser } = useAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Thêm age vào state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '', 
    riskTolerance: 'medium',
    cryptoInvestmentUsd: '',
    tradeStyle: 'swing',
  });

  // Đá về trang chủ nếu mất kết nối ví
  useEffect(() => {
    if (!connected && !publicKey) {
      router.push('/');
    }
  }, [connected, publicKey, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Ngăn reload trang
    
    if (!publicKey) {
      alert("Wallet not connected!");
      return;
    }

    // Validate cơ bản
    if (!formData.email || !formData.age) {
        alert("Please enter Email and Age");
        return;
    }

    setIsSubmitting(true);

    try {
      console.log("📤 Submitting form data...");
      
      const payload = {
        walletAddress: publicKey.toBase58(),
        name: formData.name,
        email: formData.email,
        age: parseInt(formData.age), // Chuyển đổi age sang số
        riskTolerance: formData.riskTolerance,
        tradeStyle: formData.tradeStyle,
        cryptoInvestmentUsd: parseFloat(formData.cryptoInvestmentUsd) || 0,
        totalAssetUsd: parseFloat(formData.cryptoInvestmentUsd) || 0, // Giả định bằng vốn crypto
        notificationEnabled: true
      };

      const res = await fetch('/api/user/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      console.log("🎉 Success! User saved:", data);
      
      // Cập nhật AuthContext với user thật từ DB
      setUser(data);
      
      // Đợi 1 chút cho state cập nhật rồi mới chuyển
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);

    } catch (error: any) {
      console.error("❌ Onboarding failed:", error);
      alert("Lỗi tạo tài khoản: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!publicKey) return null;

  return (
    <div className="min-h-screen bg-[#0a0118] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-card p-8 rounded-2xl border border-white/10">
        <h1 className="text-3xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
          Setup Profile
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Wallet (Read only) */}
          <div className="p-3 bg-white/5 rounded-lg border border-white/10 flex items-center gap-2 text-slate-400 text-xs font-mono">
            <Wallet size={14} />
            {publicKey.toBase58()}
          </div>

          {/* Email Field (Mới) */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                Email <span className="text-red-500">*</span>
            </label>
            <input 
              required
              type="email" 
              placeholder="you@example.com"
              className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>

          {/* Name Field */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Display Name</label>
            <input 
              required
              type="text" 
              placeholder="Your Name"
              className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>

          {/* Age & Capital Grid */}
          <div className="grid grid-cols-2 gap-4">
             {/* Age Field (Mới) */}
             <div>
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    Age <span className="text-red-500">*</span>
                </label>
                <input 
                  required
                  type="number" 
                  placeholder="25"
                  min="18"
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                  value={formData.age}
                  onChange={e => setFormData({...formData, age: e.target.value})}
                />
             </div>

             {/* Capital Field */}
             <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Capital ($)</label>
                <input 
                  required
                  type="number" 
                  placeholder="1000"
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                  value={formData.cryptoInvestmentUsd}
                  onChange={e => setFormData({...formData, cryptoInvestmentUsd: e.target.value})}
                />
             </div>
          </div>

          {/* Risk Level */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Risk Level</label>
            <select 
              className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg p-3 text-white outline-none cursor-pointer"
              value={formData.riskTolerance}
              onChange={e => setFormData({...formData, riskTolerance: e.target.value})}
            >
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full mt-6 bg-gradient-to-r from-purple-600 to-cyan-600 hover:opacity-90 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <>Complete Setup <ArrowRight size={18} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}