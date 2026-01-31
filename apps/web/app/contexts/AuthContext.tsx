'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';

// Định nghĩa cấu trúc User
interface UserBalance {
  tokenAddress: string;
  balance: string;
  updatedAt: Date | string;
}

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
  balances?: UserBalance[];
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
  const { disconnect } = useWallet();

  // Hàm xác thực ví quan trọng nhất
  const verifyWallet = async (address: string) => {
    if (!address) return;
    
    try {
      setIsLoading(true);
      console.log("🔐 Verifying wallet:", address);

      // Gọi API kiểm tra
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      });
      
      const data = await res.json();

      // LOGIC ĐIỀU HƯỚNG CHÍNH
      if (data.user && !data.requiresOnboarding) {
        // Trường hợp 1: User đã tồn tại và đủ thông tin -> Dashboard
        console.log("✅ User verified, redirecting to Dashboard");
        setUser(data.user);
        router.push('/dashboard');
      } else {
        // Trường hợp 2: User chưa có HOẶC thiếu thông tin -> Onboarding
        console.log("🆕 New or incomplete user, redirecting to Onboarding");
        // Nếu user tồn tại nhưng thiếu thông tin, ta vẫn set tạm để trang Onboarding có thể dùng (nếu cần)
        // Nhưng an toàn nhất là để null hoặc user tạm để Onboarding form xử lý
        if (data.user) setUser(data.user); 
        router.push('/onboarding');
      }

    } catch (error) {
      console.error("❌ Verify Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    await disconnect();
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