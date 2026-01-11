'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { Loader2, User, Mail, Briefcase, DollarSign, TrendingUp } from 'lucide-react';

export function OnboardingForm() {
  const navigate = useNavigate();
  const { publicKey, connected } = useWallet();
  const { refreshUser } = useAuth();
  
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
  if (!connected) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey) {
      toast.error('Wallet not connected');
      return;
    }

    // Validate email
    if (!formData.email) {
      toast.error('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email');
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
          tradeStyle: formData.tradeStyle,
          totalAssetUsd: formData.totalAssetUsd ? parseFloat(formData.totalAssetUsd) : 0,
          cryptoInvestmentUsd: formData.cryptoInvestmentUsd ? parseFloat(formData.cryptoInvestmentUsd) : 0,
          riskTolerance: formData.riskTolerance,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to create account');
        return;
      }

      toast.success('Account created successfully!');
      
      // Refresh user data
      refreshUser();

      // Redirect to dashboard
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);

    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error('Failed to create account');
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
      <div className="absolute inset-0 bg-gradient-to-br from-cyber-purple/20 via-transparent to-cyber-cyan/20" />
      
      <div className="relative z-10 w-full max-w-2xl">
        <div className="glass-card rounded-2xl p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-100 mb-3">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-cyber-purple to-cyber-cyan bg-clip-text text-transparent">
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
              <Label htmlFor="email" className="text-slate-200 flex items-center gap-2">
                <Mail className="w-4 h-4 text-cyber-cyan" />
                Email <span className="text-red-400">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                className="mt-2 bg-slate-900/50 border-slate-700 text-slate-100"
              />
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="name" className="text-slate-200 flex items-center gap-2">
                <User className="w-4 h-4 text-cyber-purple" />
                Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="mt-2 bg-slate-900/50 border-slate-700 text-slate-100"
              />
            </div>

            {/* Age */}
            <div>
              <Label htmlFor="age" className="text-slate-200">
                Age
              </Label>
              <Input
                id="age"
                type="number"
                placeholder="25"
                value={formData.age}
                onChange={(e) => handleChange('age', e.target.value)}
                min="18"
                max="100"
                className="mt-2 bg-slate-900/50 border-slate-700 text-slate-100"
              />
            </div>

            {/* Trade Style */}
            <div>
              <Label htmlFor="tradeStyle" className="text-slate-200 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-cyber-cyan" />
                Trading Style
              </Label>
              <Input
                id="tradeStyle"
                type="text"
                placeholder="e.g., Day Trading, Swing Trading, HODLer"
                value={formData.tradeStyle}
                onChange={(e) => handleChange('tradeStyle', e.target.value)}
                className="mt-2 bg-slate-900/50 border-slate-700 text-slate-100"
              />
            </div>

            {/* Total Assets */}
            <div>
              <Label htmlFor="totalAssetUsd" className="text-slate-200 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                Total Assets (USD)
              </Label>
              <Input
                id="totalAssetUsd"
                type="number"
                placeholder="10000"
                value={formData.totalAssetUsd}
                onChange={(e) => handleChange('totalAssetUsd', e.target.value)}
                min="0"
                step="0.01"
                className="mt-2 bg-slate-900/50 border-slate-700 text-slate-100"
              />
            </div>

            {/* Crypto Investment */}
            <div>
              <Label htmlFor="cryptoInvestmentUsd" className="text-slate-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyber-purple" />
                Crypto Investment (USD)
              </Label>
              <Input
                id="cryptoInvestmentUsd"
                type="number"
                placeholder="5000"
                value={formData.cryptoInvestmentUsd}
                onChange={(e) => handleChange('cryptoInvestmentUsd', e.target.value)}
                min="0"
                step="0.01"
                className="mt-2 bg-slate-900/50 border-slate-700 text-slate-100"
              />
            </div>

            {/* Risk Tolerance */}
            <div>
              <Label className="text-slate-200 mb-3 block">
                Risk Tolerance
              </Label>
              <div className="space-y-4">
                <div className="flex justify-between text-sm text-slate-400">
                  <span className={formData.riskTolerance === 'low' ? 'text-green-400 font-semibold' : ''}>
                    Conservative
                  </span>
                  <span className={formData.riskTolerance === 'medium' ? 'text-yellow-400 font-semibold' : ''}>
                    Balanced
                  </span>
                  <span className={formData.riskTolerance === 'high' ? 'text-red-400 font-semibold' : ''}>
                    Aggressive
                  </span>
                </div>
                
                <div className="flex gap-3">
                  {['low', 'medium', 'high'].map((risk) => (
                    <button
                      key={risk}
                      type="button"
                      onClick={() => handleChange('riskTolerance', risk)}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                        formData.riskTolerance === risk
                          ? 'border-cyber-purple bg-cyber-purple/20 text-slate-100'
                          : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {getRiskLabel(risk)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || !formData.email}
              className="w-full bg-gradient-to-r from-cyber-purple to-cyber-cyan hover:opacity-90 text-white font-semibold py-6 text-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Complete Setup'
              )}
            </Button>

            <p className="text-xs text-slate-500 text-center">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}