'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// Định nghĩa kiểu dữ liệu cho User
interface User {
  _id: string;
  walletAddress: string;
  name?: string;
  email?: string;
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
  isLoading: boolean; // [Mới] Để hiển thị loading spinner
  setUser: (user: User | null) => void; // [Mới] Để Dev Mode hoạt động
  verifyWallet: (address: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false); // [Mới] State loading
  const router = useRouter();

  // Hàm xử lý logic đăng nhập/đăng ký
  const verifyWallet = async (address: string) => {
    if (!address) return;

    try {
      setIsLoading(true); // Bắt đầu loading
      console.log("🔐 Verifying wallet:", address);

      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();

      if (data.exists && data.user) {
        console.log("✅ User exists, logging in...");
        setUser(data.user);
        router.push('/dashboard');
      } else {
        console.log("🆕 New user, redirecting to onboarding...");
        router.push('/onboarding');
      }
    } catch (error) {
      console.error("❌ Verify error:", error);
    } finally {
      setIsLoading(false); // Kết thúc loading
    }
  };

  const logout = () => {
    setUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        isAuthenticated: !!user, 
        isLoading, 
        setUser, 
        verifyWallet, 
        logout 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}