# 🚀 Migration Guide: Mock Data → Real API

## 📋 Overview

Guide này hướng dẫn step-by-step để migrate từ:
- ❌ Mock data trong `localStorage` + hardcoded arrays
- ✅ Real API calls đến MongoDB backend

---

## 🎯 Migration Strategy

### Phase 1: Setup (30 phút)
1. Tạo environment variables
2. Tạo API client service
3. Setup authentication interceptor

### Phase 2: API Integration (2-3 giờ)
1. Update hooks để call real API
2. Handle loading/error states
3. Update mock API interceptor

### Phase 3: Testing & Cleanup (1 giờ)
1. Test all endpoints
2. Remove mock code
3. Update error handling

---

## 📁 PHASE 1: SETUP

### Step 1.1: Tạo Environment Variables

**File: `.env`** (tạo mới ở root project)
```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3000/api
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key

# Development Mode
VITE_USE_MOCK_API=false  # Set true để dùng mock, false để dùng real API

# Solana Configuration
VITE_SOLANA_NETWORK=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
```

**File: `.env.example`** (commit vào Git để team biết)
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_USE_MOCK_API=true
VITE_SOLANA_NETWORK=devnet
```

---

### Step 1.2: Tạo API Config

**File: `/src/app/config/api.config.ts`** (tạo mới)
```typescript
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  useMock: import.meta.env.VITE_USE_MOCK_API === 'true',
  timeout: 30000, // 30 seconds
  
  // Endpoints
  endpoints: {
    // Auth
    auth: {
      verify: '/auth/verify',
      login: '/auth/login',
      logout: '/auth/logout',
    },
    
    // User
    user: {
      profile: '/user/profile',
      create: '/user/create',
      update: '/user/profile',
    },
    
    // Proposals
    proposals: {
      list: '/proposals',
      detail: (id: string) => `/proposals/${id}`,
      filter: '/proposals/filter',
    },
    
    // Trades
    trades: {
      execute: '/trades/execute',
      history: '/trades/history',
    },
    
    // Portfolio
    portfolio: {
      summary: '/portfolio',
      holdings: '/portfolio/holdings',
    },
    
    // Signals (for evidence lookup)
    signals: {
      detail: (id: string) => `/signals/${id}`,
    },
  },
};
```

---

### Step 1.3: Tạo API Client Service

**File: `/src/app/services/apiClient.ts`** (tạo mới)
```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { API_CONFIG } from '../config/api.config';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.baseURL,
      timeout: API_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - Add auth token
    this.client.interceptors.request.use(
      (config) => {
        // Get wallet address from localStorage (or your auth context)
        const walletAddress = localStorage.getItem('ndl_wallet_address');
        
        if (walletAddress) {
          config.headers.Authorization = `Bearer ${walletAddress}`;
        }

        // Log request in development
        if (import.meta.env.DEV) {
          console.log('🚀 API Request:', {
            method: config.method?.toUpperCase(),
            url: config.url,
            data: config.data,
          });
        }

        return config;
      },
      (error) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle errors globally
    this.client.interceptors.response.use(
      (response) => {
        // Log response in development
        if (import.meta.env.DEV) {
          console.log('✅ API Response:', {
            url: response.config.url,
            status: response.status,
            data: response.data,
          });
        }
        return response;
      },
      (error: AxiosError) => {
        // Handle common errors
        if (error.response) {
          const status = error.response.status;
          
          switch (status) {
            case 401:
              console.error('🔒 Unauthorized - Redirecting to login');
              // TODO: Redirect to login or reconnect wallet
              window.location.href = '/';
              break;
              
            case 403:
              console.error('🚫 Forbidden - Access denied');
              break;
              
            case 404:
              console.error('🔍 Not Found');
              break;
              
            case 500:
              console.error('💥 Server Error');
              break;
              
            default:
              console.error(`❌ API Error (${status}):`, error.response.data);
          }
        } else if (error.request) {
          console.error('📡 Network Error - No response received');
        } else {
          console.error('⚠️ Request Setup Error:', error.message);
        }

        return Promise.reject(error);
      }
    );
  }

  // Generic methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
```

---

## 📁 PHASE 2: UPDATE HOOKS

### Step 2.1: Update useProposals Hook

**File: `/src/app/hooks/useProposals.ts`**

**BEFORE (Mock):**
```typescript
export function useProposals() {
  const [proposals, setProposals] = useState<Proposal[]>(mockProposals);
  // ...
}
```

**AFTER (Real API):**
```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { API_CONFIG } from '../config/api.config';
import { mockProposals } from '../data/mockProposals'; // Keep for fallback

export interface Proposal {
  // ... (giữ nguyên interface)
}

export function useProposals(filter?: 'BUY' | 'SELL') {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProposals();
  }, [filter]);

  const fetchProposals = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if using mock API
      if (API_CONFIG.useMock) {
        console.log('📦 Using Mock Data');
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
        
        let data = mockProposals;
        if (filter) {
          data = data.filter(p => p.action === filter);
        }
        
        setProposals(data);
        setLoading(false);
        return;
      }

      // Real API call
      const endpoint = filter 
        ? `${API_CONFIG.endpoints.proposals.filter}?action=${filter}`
        : API_CONFIG.endpoints.proposals.list;

      const data = await apiClient.get<Proposal[]>(endpoint);
      
      setProposals(data);
      
    } catch (err: any) {
      console.error('Error fetching proposals:', err);
      setError(err.message || 'Failed to fetch proposals');
      
      // Fallback to mock data on error (optional)
      if (import.meta.env.DEV) {
        console.warn('⚠️ Falling back to mock data');
        setProposals(filter ? mockProposals.filter(p => p.action === filter) : mockProposals);
      }
      
    } finally {
      setLoading(false);
    }
  };

  return {
    proposals,
    loading,
    error,
    refetch: fetchProposals,
  };
}

// Single proposal hook
export function useProposal(id: string) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProposal();
  }, [id]);

  const fetchProposal = async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);

    try {
      if (API_CONFIG.useMock) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const data = mockProposals.find(p => p._id === id);
        
        if (!data) {
          throw new Error('Proposal not found');
        }
        
        setProposal(data);
        setLoading(false);
        return;
      }

      const data = await apiClient.get<Proposal>(
        API_CONFIG.endpoints.proposals.detail(id)
      );
      
      setProposal(data);
      
    } catch (err: any) {
      console.error('Error fetching proposal:', err);
      setError(err.message || 'Failed to fetch proposal');
      
      // Fallback
      if (import.meta.env.DEV) {
        const fallback = mockProposals.find(p => p._id === id);
        if (fallback) setProposal(fallback);
      }
      
    } finally {
      setLoading(false);
    }
  };

  return {
    proposal,
    loading,
    error,
    refetch: fetchProposal,
  };
}
```

---

### Step 2.2: Update useAuth Hook

**File: `/src/app/hooks/useAuth.ts`** (tạo mới hoặc update)

```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { API_CONFIG } from '../config/api.config';

export interface User {
  _id: string;
  walletAddress: string;
  email?: string;
  fullName?: string;
  riskTolerance?: 'low' | 'medium' | 'high';
  tradingStyle?: string;
  createdAt: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const walletAddress = localStorage.getItem('ndl_wallet_address');
    
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    try {
      if (API_CONFIG.useMock) {
        // Mock auth
        const mockUser = JSON.parse(
          localStorage.getItem(`ndl_user_${walletAddress}`) || 'null'
        );
        setUser(mockUser);
        setLoading(false);
        return;
      }

      // Real API call
      const data = await apiClient.post<{ user: User }>(
        API_CONFIG.endpoints.auth.verify,
        { walletAddress }
      );

      setUser(data.user);
      
    } catch (err) {
      console.error('Auth check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (walletAddress: string) => {
    try {
      if (API_CONFIG.useMock) {
        localStorage.setItem('ndl_wallet_address', walletAddress);
        await checkAuth();
        return;
      }

      const data = await apiClient.post<{ user: User }>(
        API_CONFIG.endpoints.auth.login,
        { walletAddress }
      );

      localStorage.setItem('ndl_wallet_address', walletAddress);
      setUser(data.user);
      
    } catch (err) {
      console.error('Login failed:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      if (!API_CONFIG.useMock) {
        await apiClient.post(API_CONFIG.endpoints.auth.logout);
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('ndl_wallet_address');
      setUser(null);
    }
  };

  const createUser = async (userData: Partial<User>) => {
    try {
      if (API_CONFIG.useMock) {
        const walletAddress = localStorage.getItem('ndl_wallet_address')!;
        const newUser: User = {
          _id: Math.random().toString(),
          walletAddress,
          createdAt: new Date().toISOString(),
          ...userData,
        };
        
        localStorage.setItem(`ndl_user_${walletAddress}`, JSON.stringify(newUser));
        setUser(newUser);
        return;
      }

      const data = await apiClient.post<{ user: User }>(
        API_CONFIG.endpoints.user.create,
        userData
      );

      setUser(data.user);
      
    } catch (err) {
      console.error('Create user failed:', err);
      throw err;
    }
  };

  return {
    user,
    loading,
    login,
    logout,
    createUser,
    refetch: checkAuth,
  };
}
```

---

### Step 2.3: Create usePortfolio Hook

**File: `/src/app/hooks/usePortfolio.ts`** (tạo mới)

```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { API_CONFIG } from '../config/api.config';

export interface Holding {
  symbol: string;
  name: string;
  amount: number;
  valueUSD: number;
  change24h: number;
  allocation: number;
}

export interface Trade {
  _id: string;
  action: 'BUY' | 'SELL';
  symbol: string;
  amount: number;
  price: number;
  timestamp: string;
}

export interface Portfolio {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  change24h: number;
  change24hPercent: number;
  holdings: Holding[];
  recentTrades: Trade[];
}

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    setLoading(true);
    setError(null);

    try {
      if (API_CONFIG.useMock) {
        // Mock portfolio data
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const mockPortfolio: Portfolio = {
          totalValue: 27432.15,
          totalPnL: 2432.15,
          totalPnLPercent: 9.73,
          change24h: 1250.30,
          change24hPercent: 4.78,
          holdings: [
            {
              symbol: 'SOL',
              name: 'Solana',
              amount: 125.5,
              valueUSD: 12324.50,
              change24h: 5.2,
              allocation: 45,
            },
            {
              symbol: 'USDC',
              name: 'USD Coin',
              amount: 10000,
              valueUSD: 10000,
              change24h: 0,
              allocation: 36,
            },
          ],
          recentTrades: [
            {
              _id: '1',
              action: 'BUY',
              symbol: 'SOL',
              amount: 2.5,
              price: 142.50,
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            },
          ],
        };
        
        setPortfolio(mockPortfolio);
        setLoading(false);
        return;
      }

      // Real API call
      const data = await apiClient.get<Portfolio>(
        API_CONFIG.endpoints.portfolio.summary
      );

      setPortfolio(data);
      
    } catch (err: any) {
      console.error('Error fetching portfolio:', err);
      setError(err.message || 'Failed to fetch portfolio');
    } finally {
      setLoading(false);
    }
  };

  return {
    portfolio,
    loading,
    error,
    refetch: fetchPortfolio,
  };
}
```

---

### Step 2.4: Create useTrade Hook

**File: `/src/app/hooks/useTrade.ts`** (tạo mới)

```typescript
import { useState } from 'react';
import { apiClient } from '../services/apiClient';
import { API_CONFIG } from '../config/api.config';

export interface ExecuteTradeParams {
  proposalId: string;
  action: 'BUY' | 'SELL';
  amount: number;
  walletAddress: string;
}

export interface ExecuteTradeResponse {
  success: boolean;
  transactionSignature?: string;
  trade: {
    _id: string;
    symbol: string;
    action: 'BUY' | 'SELL';
    amount: number;
    timestamp: string;
  };
}

export function useTrade() {
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeTrade = async (params: ExecuteTradeParams): Promise<ExecuteTradeResponse> => {
    setExecuting(true);
    setError(null);

    try {
      if (API_CONFIG.useMock) {
        // Mock execution
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const mockResponse: ExecuteTradeResponse = {
          success: true,
          transactionSignature: Math.random().toString(36).substring(7),
          trade: {
            _id: Math.random().toString(),
            symbol: 'SOL', // TODO: Get from proposal
            action: params.action,
            amount: params.amount,
            timestamp: new Date().toISOString(),
          },
        };
        
        return mockResponse;
      }

      // Real API call
      const data = await apiClient.post<ExecuteTradeResponse>(
        API_CONFIG.endpoints.trades.execute,
        params
      );

      return data;
      
    } catch (err: any) {
      console.error('Trade execution failed:', err);
      setError(err.message || 'Failed to execute trade');
      throw err;
      
    } finally {
      setExecuting(false);
    }
  };

  return {
    executeTrade,
    executing,
    error,
  };
}
```

---

## 📁 PHASE 3: UPDATE COMPONENTS

### Step 3.1: Update ProposalDetailSocial to Use Real API

**File: `/src/app/components/proposal/ProposalDetailSocial.tsx`**

**REPLACE:**
```typescript
import { useProposal } from '../../hooks/useProposals';
import { useTrade } from '../../hooks/useTrade';

export function ProposalDetailSocial() {
  const { id } = useParams<{ id: string }>();
  const { proposal, loading, error } = useProposal(id || '');
  const { executeTrade, executing } = useTrade();
  const { connected, publicKey } = useWallet();
  const [amount, setAmount] = useState(0);
  const navigate = useNavigate();

  const handleExecuteTrade = async () => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const result = await executeTrade({
        proposalId: proposal!._id,
        action: proposal!.action,
        amount,
        walletAddress: publicKey.toBase58(),
      });

      toast.success('Trade executed successfully!', {
        description: `Transaction: ${result.transactionSignature}`,
      });

      setTimeout(() => {
        navigate('/portfolio');
      }, 1500);
      
    } catch (err: any) {
      toast.error('Failed to execute trade', {
        description: err.message,
      });
    }
  };

  // ... rest of component
}
```

---

### Step 3.2: Update Dashboard to Use Real API

**File: `/src/app/components/dashboard/Dashboard.tsx`**

**REPLACE:**
```typescript
export function Dashboard() {
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const { proposals, loading, error, refetch } = useProposals(
    filter === 'ALL' ? undefined : filter
  );

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 rounded-xl text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Error Loading Proposals</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={refetch}>Retry</Button>
        </div>
      </div>
    );
  }

  // ... rest of component
}
```

---

## 📁 PHASE 4: ENVIRONMENT SETUP

### Step 4.1: Install Dependencies

```bash
npm install axios
```

### Step 4.2: Update .gitignore

```gitignore
# Environment variables
.env
.env.local
.env.production

# Keep example
!.env.example
```

### Step 4.3: Update package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "dev:mock": "VITE_USE_MOCK_API=true vite",
    "dev:real": "VITE_USE_MOCK_API=false vite",
    "build": "tsc && vite build",
    "build:mock": "VITE_USE_MOCK_API=true vite build",
    "build:real": "VITE_USE_MOCK_API=false vite build"
  }
}
```

---

## 🧪 TESTING

### Step 5.1: Test với Mock Data

```bash
npm run dev:mock
```

Mở browser console, check logs:
```
📦 Using Mock Data
🚀 API Request: GET /proposals
✅ API Response: [...]
```

### Step 5.2: Test với Real API

```bash
# Đảm bảo backend đang chạy trên http://localhost:3000
npm run dev:real
```

Check console:
```
🚀 API Request: GET http://localhost:3000/api/proposals
✅ API Response: { data: [...] }
```

### Step 5.3: Test Error Handling

1. **Disconnect backend** → Check if fallback to mock works
2. **Invalid credentials** → Check if 401 redirects to login
3. **Network timeout** → Check error message displays

---

## 📊 MIGRATION CHECKLIST

### Backend Requirements:
- [ ] MongoDB database setup
- [ ] Express API server running
- [ ] CORS configured for frontend origin
- [ ] JWT or wallet-based authentication
- [ ] All endpoints implemented:
  - [ ] `POST /api/auth/verify`
  - [ ] `POST /api/user/create`
  - [ ] `GET /api/user/profile`
  - [ ] `GET /api/proposals`
  - [ ] `GET /api/proposals/:id`
  - [ ] `POST /api/trades/execute`
  - [ ] `GET /api/portfolio`
  - [ ] `GET /api/signals/:id`

### Frontend Updates:
- [ ] Environment variables configured
- [ ] API client created
- [ ] All hooks updated
- [ ] Components use new hooks
- [ ] Error handling implemented
- [ ] Loading states added
- [ ] Mock/Real mode switch works

### Testing:
- [ ] Mock mode works (dev)
- [ ] Real API mode works (production)
- [ ] Authentication flow works
- [ ] Proposals load correctly
- [ ] Trade execution works
- [ ] Portfolio displays correctly
- [ ] Error messages show properly

---

## 🔄 ROLLBACK PLAN

Nếu real API fail, rollback về mock:

**Quick Fix:**
```bash
# Set environment variable
VITE_USE_MOCK_API=true npm run dev
```

**Or update `.env`:**
```env
VITE_USE_MOCK_API=true
```

---

## 📞 TROUBLESHOOTING

### Issue 1: CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```

**Fix (Backend):**
```javascript
// server.js
const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  credentials: true,
}));
```

### Issue 2: 401 Unauthorized
```
API Error (401): Unauthorized
```

**Fix:**
- Check wallet address in localStorage
- Check backend authentication logic
- Check Authorization header format

### Issue 3: Network Timeout
```
Network Error - No response received
```

**Fix:**
- Check if backend is running
- Check firewall/network settings
- Increase timeout in `api.config.ts`

---

## 🎯 NEXT STEPS

1. **Setup Backend:**
   - Create Express server
   - Setup MongoDB connection
   - Implement authentication
   - Create API endpoints

2. **Test Locally:**
   - Run backend: `npm run dev` (backend)
   - Run frontend: `npm run dev:real` (frontend)
   - Test all features

3. **Deploy:**
   - Deploy backend to Heroku/Railway/Render
   - Update `VITE_API_BASE_URL` to production URL
   - Deploy frontend to Vercel/Netlify

4. **Monitor:**
   - Add error tracking (Sentry)
   - Add analytics (Mixpanel/Amplitude)
   - Monitor API performance

---

## 📚 EXAMPLE BACKEND ENDPOINT

**File: `backend/routes/proposals.js`** (Example)

```javascript
const express = require('express');
const router = express.Router();
const Proposal = require('../models/Proposal');

// GET /api/proposals
router.get('/', async (req, res) => {
  try {
    const { action } = req.query;
    
    const filter = action ? { action } : {};
    const proposals = await Proposal.find(filter)
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(proposals);
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// GET /api/proposals/:id
router.get('/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json(proposal);
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

module.exports = router;
```

---

**Good luck với migration! 🚀**
