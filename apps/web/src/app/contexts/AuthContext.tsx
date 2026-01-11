import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface User {
  _id: string;
  email: string;
  name?: string;
  walletAddress: string;
  riskTolerance: string;
  tradeStyle?: string;
  totalAssetUsd?: number;
  cryptoInvestmentUsd?: number;
  image?: string;
  notificationEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false); // Changed from true to false
  const { publicKey, disconnect } = useWallet();
  const navigate = useNavigate();

  // Verify wallet and handle routing
  const verifyWallet = async (walletAddress: string) => {
    try {
      setLoading(true);
      
      console.log('🔍 Verifying wallet:', walletAddress);
      
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });
      
      const data = await response.json();
      
      console.log('📥 Verify response:', data);
      
      if (data.error) {
        toast.error(data.error);
        return;
      }
      
      if (data.requiresOnboarding) {
        // New user - redirect to onboarding
        console.log('➡️ New user - redirecting to onboarding');
        toast.info('Welcome! Please complete your profile.');
        navigate('/onboarding');
      } else {
        // Existing user - set user data and redirect to dashboard
        console.log('✅ Existing user - redirecting to dashboard');
        setUser(data.user);
        toast.success('Welcome back!');
        navigate('/dashboard');
      }
      
    } catch (error) {
      console.error('❌ Verify wallet error:', error);
      toast.error('Failed to verify wallet');
    } finally {
      setLoading(false);
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    if (!publicKey) return;
    
    try {
      const walletAddress = publicKey.toBase58();
      const response = await fetch(`/api/user/profile?wallet=${walletAddress}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      
      const userData = await response.json();
      setUser(userData);
      
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  // Logout
  const logout = () => {
    setUser(null);
    disconnect();
    navigate('/');
    toast.success('Logged out successfully');
  };

  // Auto-verify when wallet connects
  useEffect(() => {
    if (publicKey) {
      const walletAddress = publicKey.toBase58();
      verifyWallet(walletAddress);
    } else {
      // Only set loading to false if we're sure there's no wallet
      setLoading(false);
    }
  }, [publicKey]);

  const value = {
    user,
    setUser,
    loading,
    refreshUser,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}