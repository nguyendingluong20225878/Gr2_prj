'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  _id: string;
  walletAddress: string;
  name?: string;
  email?: string;
  age?: number;
  riskTolerance?: string;
  tradeStyle?: string;
  totalAssetUsd?: number;
  cryptoInvestmentUsd?: number;
  image?: string;
  notificationEnabled?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  verifyWallet: (address: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const verifyWallet = async (address: string) => {
    if (!address) return;

    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();

      if (data.user) {
        setUser(data.user);
        // SỬA: Nếu đã có user trong DB, đi thẳng tới Dashboard
        // Bỏ qua check data.requiresOnboarding nếu user đã tồn tại
        router.push('/dashboard');
      } else {
        // Chỉ vào onboarding nếu chưa có user
        router.push('/onboarding');
      }
    } catch (error) {
      console.error("❌ Verify error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, setUser, verifyWallet, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}