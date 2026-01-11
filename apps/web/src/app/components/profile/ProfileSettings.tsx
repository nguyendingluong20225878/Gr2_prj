'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { 
  User, 
  Mail, 
  Briefcase, 
  DollarSign, 
  TrendingUp, 
  Wallet, 
  Calendar,
  Loader2,
  Save,
  Shield
} from 'lucide-react';

interface UserProfile {
  _id: string;
  email: string;
  name?: string;
  age?: number;
  walletAddress: string;
  riskTolerance: string;
  tradeStyle?: string;
  totalAssetUsd?: number;
  cryptoInvestmentUsd?: number;
  image?: string;
  notificationEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function ProfileSettings() {
  const navigate = useNavigate();
  const { publicKey, connected } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    tradeStyle: '',
    totalAssetUsd: '',
    cryptoInvestmentUsd: '',
    riskTolerance: 'medium',
    notificationEnabled: false,
  });

  // Redirect if not connected
  useEffect(() => {
    if (!connected) {
      navigate('/');
    }
  }, [connected, navigate]);

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!publicKey) return;
      
      try {
        setLoading(true);
        const walletAddress = publicKey.toBase58();
        const response = await fetch(`/api/user/profile?wallet=${walletAddress}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        
        const data = await response.json();
        setProfile(data);
        
        // Set form data
        setFormData({
          name: data.name || '',
          age: data.age?.toString() || '',
          tradeStyle: data.tradeStyle || '',
          totalAssetUsd: data.totalAssetUsd?.toString() || '',
          cryptoInvestmentUsd: data.cryptoInvestmentUsd?.toString() || '',
          riskTolerance: data.riskTolerance || 'medium',
          notificationEnabled: data.notificationEnabled || false,
        });
        
      } catch (error) {
        console.error('Fetch profile error:', error);
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [publicKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey) return;

    setSaving(true);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          updates: {
            name: formData.name,
            age: formData.age ? parseInt(formData.age) : undefined,
            tradeStyle: formData.tradeStyle,
            totalAssetUsd: formData.totalAssetUsd ? parseFloat(formData.totalAssetUsd) : 0,
            cryptoInvestmentUsd: formData.cryptoInvestmentUsd ? parseFloat(formData.cryptoInvestmentUsd) : 0,
            riskTolerance: formData.riskTolerance,
            notificationEnabled: formData.notificationEnabled,
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to update profile');
        return;
      }

      setProfile(prev => prev ? { ...prev, ...data.user } : null);
      toast.success('Profile updated successfully!');

    } catch (error) {
      console.error('Update profile error:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getRiskBadge = (risk: string) => {
    const variants: Record<string, any> = {
      low: { label: 'Conservative', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
      medium: { label: 'Balanced', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      high: { label: 'Aggressive', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    };
    const variant = variants[risk] || variants.medium;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="glass-card rounded-xl p-8">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-slate-400">Profile not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Profile Settings</h1>
        <p className="text-slate-400">Manage your account information and preferences</p>
      </div>

      {/* Profile Info Card */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyber-purple to-cyber-cyan flex items-center justify-center text-2xl font-bold text-white">
            {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
          </div>
          
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-100 mb-1">
              {profile.name || 'Anonymous User'}
            </h2>
            <div className="flex items-center gap-2 text-slate-400 mb-3">
              <Mail className="w-4 h-4" />
              <span>{profile.email}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Wallet className="w-4 h-4" />
                <span className="text-sm">{formatWalletAddress(profile.walletAddress)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-400" />
                {getRiskBadge(profile.riskTolerance)}
              </div>
            </div>
          </div>
          
          <div className="text-right text-sm text-slate-500">
            <div className="flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3" />
              <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit}>
        <div className="glass-card rounded-xl p-8">
          <h3 className="text-xl font-semibold text-slate-100 mb-6">Personal Information</h3>
          
          <div className="space-y-6">
            {/* Email - Read Only */}
            <div>
              <Label className="text-slate-200 flex items-center gap-2">
                <Mail className="w-4 h-4 text-cyber-cyan" />
                Email
              </Label>
              <Input
                type="email"
                value={profile.email}
                disabled
                className="mt-2 bg-slate-900/50 border-slate-700 text-slate-400 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
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
                value={formData.tradeStyle}
                onChange={(e) => handleChange('tradeStyle', e.target.value)}
                placeholder="e.g., Day Trading, Swing Trading"
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
                    {risk === 'low' ? 'Conservative' : risk === 'medium' ? 'Balanced' : 'Aggressive'}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700">
              <div>
                <Label className="text-slate-200 mb-1 block">Trade Notifications</Label>
                <p className="text-sm text-slate-400">Receive notifications about trades and signals</p>
              </div>
              <button
                type="button"
                onClick={() => handleChange('notificationEnabled', !formData.notificationEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formData.notificationEnabled ? 'bg-cyber-purple' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    formData.notificationEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-8 flex gap-3">
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-cyber-purple to-cyber-cyan hover:opacity-90"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}