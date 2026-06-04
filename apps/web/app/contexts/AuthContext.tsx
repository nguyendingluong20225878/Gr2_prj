'use client';

import React, { createContext, useCallback, useContext, useState, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

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
  loading: boolean;
  setUser: (user: User | null) => void;
  verifyWallet: (address: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { disconnect, publicKey, signMessage } = useWallet();

  const routeAfterAuth = useCallback((data: { user?: User | null; requiresOnboarding?: boolean }) => {
    if (data.user) {
      setUser(data.user);
    }

    router.push('/overview');
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const hydrateSession = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/auth/verify');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.user) setUser(data.user);
      } catch (error) {
        console.error('Session hydrate error:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void hydrateSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const verifyWallet = useCallback(async (address: string) => {
    if (!address || !publicKey) return;
    if (!signMessage) {
      throw new Error('Wallet does not support message signing');
    }
    
    try {
      setIsLoading(true);
      console.log('Verifying wallet signature:', address);

      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      });
      const nonceData = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nonceData.error || 'Cannot create auth nonce');

      const messageBytes = new TextEncoder().encode(nonceData.message);
      const signature = await signMessage(messageBytes);
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          message: nonceData.message,
          signature: bs58.encode(signature),
        }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(data.error || 'Signature verification failed');
      routeAfterAuth(data);
    } catch (error) {
      console.error('Verify Error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, routeAfterAuth, signMessage]);

  const logout = async () => {
    setUser(null);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    await disconnect();
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, loading: isLoading, setUser, verifyWallet, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
