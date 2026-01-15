# 🚀 NDL AI - API Integration Guide

## 📋 Overview

NDL AI sử dụng **Next.js 15 App Router** với MongoDB backend. Guide này hướng dẫn cách tích hợp Real API.

---

## 🔧 Environment Variables

Tạo file `.env.local` ở root project:

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_USE_MOCK_API=false

# Solana Configuration  
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# MongoDB (for backend)
MONGODB_URI=mongodb://localhost:27017/ndl-ai
```

---

## 📡 API Endpoints

### Authentication
```
POST /api/auth/verify
Body: { walletAddress: string }
Response: { user: User, isNewUser: boolean }
```

### User Management
```
POST /api/user/create
Body: { walletAddress, email?, fullName?, riskTolerance?, tradingStyle? }
Response: { user: User }

GET /api/user/profile
Headers: { Authorization: Bearer <walletAddress> }
Response: { user: User }

PATCH /api/user/profile
Headers: { Authorization: Bearer <walletAddress> }
Body: { email?, fullName?, riskTolerance?, tradingStyle? }
Response: { user: User }
```

### Proposals (Trading Signals)
```
GET /api/proposals
Query: { action?: 'BUY' | 'SELL', limit?: number }
Response: { proposals: Proposal[] }

GET /api/proposals/:id
Response: { proposal: Proposal }

GET /api/proposals/filter?action=BUY
Response: { proposals: Proposal[] }
```

### Trades
```
POST /api/trades/execute
Body: { 
  proposalId: string,
  action: 'BUY' | 'SELL',
  amount: number,
  walletAddress: string 
}
Response: { 
  success: boolean,
  transactionSignature: string,
  trade: Trade 
}

GET /api/trades/history
Headers: { Authorization: Bearer <walletAddress> }
Response: { trades: Trade[] }
```

### Portfolio
```
GET /api/portfolio
Headers: { Authorization: Bearer <walletAddress> }
Response: {
  totalValue: number,
  totalPnL: number,
  totalPnLPercent: number,
  change24h: number,
  change24hPercent: number,
  holdings: Holding[],
  recentTrades: Trade[]
}
```

### Signals (Social Evidence)
```
GET /api/signals/:id
Response: { 
  signal: Signal,
  evidence: Evidence,
  tweets: Tweet[] 
}
```

---

## 📦 Data Models

### User
```typescript
interface User {
  _id: string;
  walletAddress: string;
  email?: string;
  fullName?: string;
  riskTolerance?: 'low' | 'medium' | 'high';
  tradingStyle?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Proposal
```typescript
interface Proposal {
  _id: string;
  action: 'BUY' | 'SELL';
  symbol: string;
  symbolName: string;
  confidence: number;
  expectedReturn: number;
  timeHorizon: string;
  socialSentiment: {
    score: number;
    trending: boolean;
    tweetVolume: number;
    influencerMentions: number;
  };
  reasoning: string;
  createdAt: string;
}
```

### Trade
```typescript
interface Trade {
  _id: string;
  userId: string;
  proposalId: string;
  action: 'BUY' | 'SELL';
  symbol: string;
  amount: number;
  price: number;
  transactionSignature: string;
  timestamp: string;
}
```

### Portfolio
```typescript
interface Holding {
  symbol: string;
  name: string;
  amount: number;
  valueUSD: number;
  change24h: number;
  allocation: number;
}

interface Portfolio {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  change24h: number;
  change24hPercent: number;
  holdings: Holding[];
  recentTrades: Trade[];
}
```

---

## 🔄 API Client Usage

File đã có sẵn tại `/lib/api/apiClient.ts`:

```typescript
import { apiClient } from '@/lib/api/apiClient';

// Example: Fetch proposals
const proposals = await apiClient.get('/proposals');

// Example: Create user
const user = await apiClient.post('/user/create', {
  walletAddress: '...',
  email: 'user@example.com',
  riskTolerance: 'medium',
});

// Example: Execute trade
const trade = await apiClient.post('/trades/execute', {
  proposalId: 'abc123',
  action: 'BUY',
  amount: 100,
  walletAddress: '...',
});
```

---

## 🧪 Testing

### 1. Start Backend (MongoDB + Express)
```bash
cd backend
npm install
npm run dev
# Backend runs on http://localhost:3000
```

### 2. Start Frontend (Next.js)
```bash
npm install
npm run dev
# Frontend runs on http://localhost:3001
```

### 3. Toggle Mock/Real API
```bash
# Use Mock Data
NEXT_PUBLIC_USE_MOCK_API=true npm run dev

# Use Real API  
NEXT_PUBLIC_USE_MOCK_API=false npm run dev
```

---

## 📞 Troubleshooting

### CORS Error
```javascript
// backend/server.js
const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true,
}));
```

### 401 Unauthorized
- Check `localStorage.getItem('ndl_wallet_address')`
- Verify Authorization header: `Bearer <walletAddress>`

### Connection Refused
- Ensure MongoDB is running: `mongod`
- Ensure backend is running: `npm run dev` in backend folder

---

## 🚀 Deployment

### Frontend (Vercel)
```bash
vercel deploy
```

### Backend (Railway/Render)
```bash
# Set environment variables
MONGODB_URI=mongodb+srv://...
NODE_ENV=production

# Deploy
railway up
```

---

## 📚 Next.js Server Components vs Client Components

### Server Components (Default)
- `/app/page.tsx` - Landing page
- `/app/layout.tsx` - Root layout
- No `'use client'` directive

### Client Components (Interactive)
- All files in `/app/components/*` - Use `'use client'`
- Any component using hooks (useState, useEffect, etc.)
- Components with event handlers (onClick, onChange, etc.)

---

**Good luck! 🚀**
