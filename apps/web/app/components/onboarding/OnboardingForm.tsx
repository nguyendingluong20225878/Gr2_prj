'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from '@/app/contexts/AuthContext';
// Nếu chưa có sonner, dùng alert mặc định cho đơn giản và chắc chắn chạy được
// import { toast } from 'sonner'; 
import { Loader2, Mail, User, Briefcase, DollarSign, TrendingUp, ArrowRight } from 'lucide-react';

export function OnboardingForm() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  
  // SỬA 1: Dùng setUser thay vì refreshUser
  const { setUser } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
    tradeStyle: '',
    totalAssetUsd: '',
    cryptoInvestmentUsd: '',
    riskTolerance: 'medium',
  });
  
  const [loading, setLoading] = useState(false);

  // Redirect if wallet not connected
  if (!connected && typeof window !== 'undefined') {
    router.push('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey) {
      alert('Wallet not connected');
      return;
    }

    if (!formData.email) {
      alert('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert('Please enter a valid email');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/user/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          email: formData.email,
          name: formData.name,
          age: formData.age ? parseInt(formData.age) : null,
          tradeStyle: formData.tradeStyle || 'swing',
          totalAssetUsd: formData.totalAssetUsd ? parseFloat(formData.totalAssetUsd) : 0,
          cryptoInvestmentUsd: formData.cryptoInvestmentUsd ? parseFloat(formData.cryptoInvestmentUsd) : 0,
          riskTolerance: formData.riskTolerance,
          notificationEnabled: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      console.log("User created:", data);
      
      // SỬA 2: Cập nhật trực tiếp User vào Context
      setUser(data);

      // Redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);

    } catch (error: any) {
      console.error('Onboarding error:', error);
      alert('Failed to create account: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getRiskLabel = (value: string) => {
    const labels: Record<string, string> = {
      low: 'Conservative',
      medium: 'Balanced',
      high: 'Aggressive'
    };
    return labels[value] || 'Balanced';
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center py-12 px-4">
      {/* Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-cyan-900/20" />
      
      <div className="relative z-10 w-full max-w-2xl">
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-100 mb-3">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                NDL AI
              </span>
            </h1>
            <p className="text-slate-400">
              Let's set up your profile to get started
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Email - Required */}
            <div>
              <label className="text-slate-200 flex items-center gap-2 mb-2 text-sm font-medium">
                <Mail className="w-4 h-4 text-cyan-400" />
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Name */}
            <div>
              <label className="text-slate-200 flex items-center gap-2 mb-2 text-sm font-medium">
                <User className="w-4 h-4 text-purple-400" />
                Name
              </label>
              <input
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Age & Trade Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-200 mb-2 block text-sm font-medium">Age</label>
                <input
                  type="number"
                  placeholder="25"
                  value={formData.age}
                  onChange={(e) => handleChange('age', e.target.value)}
                  min="18"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-slate-200 flex items-center gap-2 mb-2 text-sm font-medium">
                  <Briefcase className="w-4 h-4 text-cyan-400" />
                  Trading Style
                </label>
                <input
                  type="text"
                  placeholder="e.g., Swing Trading"
                  value={formData.tradeStyle}
                  onChange={(e) => handleChange('tradeStyle', e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            {/* Assets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-200 flex items-center gap-2 mb-2 text-sm font-medium">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Total Assets ($)
                </label>
                <input
                  type="number"
                  placeholder="10000"
                  value={formData.totalAssetUsd}
                  onChange={(e) => handleChange('totalAssetUsd', e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-slate-200 flex items-center gap-2 mb-2 text-sm font-medium">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  Crypto Investment ($)
                </label>
                <input
                  type="number"
                  placeholder="5000"
                  value={formData.cryptoInvestmentUsd}
                  onChange={(e) => handleChange('cryptoInvestmentUsd', e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            {/* Risk Tolerance */}
            <div>
              <label className="text-slate-200 mb-3 block text-sm font-medium">Risk Tolerance</label>
              <div className="flex gap-3">
                {['low', 'medium', 'high'].map((risk) => (
                  <button
                    key={risk}
                    type="button"
                    onClick={() => handleChange('riskTolerance', risk)}
                    className={`flex-1 py-3 px-2 rounded-lg border transition-all text-sm font-medium ${
                      formData.riskTolerance === risk
                        ? 'border-purple-500 bg-purple-500/20 text-white'
                        : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {getRiskLabel(risk)}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !formData.email}
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:opacity-90 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                 Complete Setup <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-xs text-slate-500 text-center">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}