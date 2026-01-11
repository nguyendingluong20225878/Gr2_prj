# ⚡ Quick Start: Thay Mock Data → Real API

## 🎯 TL;DR - 5 Bước Nhanh

```bash
# 1. Install axios
npm install axios

# 2. Tạo .env file
echo "VITE_API_BASE_URL=http://localhost:3000/api" > .env
echo "VITE_USE_MOCK_API=false" >> .env

# 3. Copy các file services (xem bên dưới)

# 4. Update hooks (xem bên dưới)

# 5. Run
npm run dev
```

---

## 📁 FILES CẦN TẠO/UPDATE

### ✅ Tạo Mới (Copy & Paste)

#### 1️⃣ `.env`
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_USE_MOCK_API=false
```

#### 2️⃣ `/src/app/config/api.config.ts`
```typescript
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  useMock: import.meta.env.VITE_USE_MOCK_API === 'true',
  endpoints: {
    proposals: {
      list: '/proposals',
      detail: (id: string) => `/proposals/${id}`,
    },
    trades: {
      execute: '/trades/execute',
    },
    portfolio: {
      summary: '/portfolio',
    },
  },
};
```

#### 3️⃣ `/src/app/services/apiClient.ts`
```typescript
import axios from 'axios';
import { API_CONFIG } from '../config/api.config';

class ApiClient {
  private client = axios.create({
    baseURL: API_CONFIG.baseURL,
    timeout: 30000,
  });

  constructor() {
    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      const wallet = localStorage.getItem('ndl_wallet_address');
      if (wallet) {
        config.headers.Authorization = `Bearer ${wallet}`;
      }
      console.log('🚀 API:', config.method?.toUpperCase(), config.url);
      return config;
    });

    // Handle errors
    this.client.interceptors.response.use(
      (response) => {
        console.log('✅ Response:', response.data);
        return response;
      },
      (error) => {
        console.error('❌ Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string): Promise<T> {
    const res = await this.client.get<T>(url);
    return res.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const res = await this.client.post<T>(url, data);
    return res.data;
  }
}

export const apiClient = new ApiClient();
```

---

### ✏️ Update Existing

#### 4️⃣ `/src/app/hooks/useProposals.ts`

**THÊM VÀO đầu file:**
```typescript
import { apiClient } from '../services/apiClient';
import { API_CONFIG } from '../config/api.config';
```

**THAY THẾ hàm useProposals():**
```typescript
export function useProposals(filter?: 'BUY' | 'SELL') {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProposals();
  }, [filter]);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      // 🎯 Check if using mock
      if (API_CONFIG.useMock) {
        console.log('📦 Using Mock Data');
        await new Promise(r => setTimeout(r, 500));
        let data = mockProposals;
        if (filter) data = data.filter(p => p.action === filter);
        setProposals(data);
        return;
      }

      // 🚀 Real API call
      const url = filter 
        ? `${API_CONFIG.endpoints.proposals.list}?action=${filter}`
        : API_CONFIG.endpoints.proposals.list;
      
      const data = await apiClient.get<Proposal[]>(url);
      setProposals(data);

    } catch (err: any) {
      console.error('❌ Fetch failed:', err);
      setError(err.message);
      
      // Fallback to mock
      setProposals(mockProposals);
    } finally {
      setLoading(false);
    }
  };

  return { proposals, loading, error, refetch: fetchProposals };
}
```

**THAY THẾ hàm useProposal():**
```typescript
export function useProposal(id: string) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchProposal();
  }, [id]);

  const fetchProposal = async () => {
    setLoading(true);
    try {
      // Mock mode
      if (API_CONFIG.useMock) {
        await new Promise(r => setTimeout(r, 300));
        const data = mockProposals.find(p => p._id === id);
        if (!data) throw new Error('Not found');
        setProposal(data);
        return;
      }

      // Real API
      const data = await apiClient.get<Proposal>(
        API_CONFIG.endpoints.proposals.detail(id)
      );
      setProposal(data);

    } catch (err: any) {
      setError(err.message);
      // Fallback
      const fallback = mockProposals.find(p => p._id === id);
      if (fallback) setProposal(fallback);
    } finally {
      setLoading(false);
    }
  };

  return { proposal, loading, error, refetch: fetchProposal };
}
```

---

## 🧪 TESTING

### Test Mock Mode (Dev):
```bash
# .env
VITE_USE_MOCK_API=true

# Run
npm run dev
```

**Console sẽ thấy:**
```
📦 Using Mock Data
```

### Test Real API Mode:
```bash
# .env
VITE_USE_MOCK_API=false

# Đảm bảo backend chạy trên http://localhost:3000

# Run
npm run dev
```

**Console sẽ thấy:**
```
🚀 API: GET /proposals
✅ Response: [{ _id: "1", ... }]
```

---

## 🔧 BACKEND ENDPOINT FORMAT

Backend của bạn cần trả về đúng format:

### `GET /api/proposals`
```json
[
  {
    "_id": "1",
    "tokenSymbol": "SOL",
    "tokenName": "Solana",
    "title": "Strategic Entry for Solana",
    "action": "BUY",
    "confidence": 87,
    "sentimentType": "positive",
    "sentimentScore": 75,
    "financialImpact": {
      "currentValue": 142.50,
      "projectedValue": 165.00,
      "riskLevel": "MEDIUM"
    },
    "reason": [
      "Social sentiment is positive",
      "Key influencers are bullish"
    ],
    "rationaleSummary": "Strong social momentum...",
    "sources": [
      "https://twitter.com/..."
    ],
    "triggerEventId": "x-scraper",
    "expiresAt": "2025-01-18T10:00:00Z"
  }
]
```

### `GET /api/proposals/:id`
```json
{
  "_id": "1",
  "tokenSymbol": "SOL",
  // ... same structure as above
}
```

### `POST /api/trades/execute`
**Request:**
```json
{
  "proposalId": "1",
  "action": "BUY",
  "amount": 500,
  "walletAddress": "ABC123..."
}
```

**Response:**
```json
{
  "success": true,
  "transactionSignature": "xyz789...",
  "trade": {
    "_id": "trade_1",
    "symbol": "SOL",
    "action": "BUY",
    "amount": 500,
    "timestamp": "2025-01-11T..."
  }
}
```

---

## 🚨 COMMON ISSUES

### Issue 1: "Network Error"
```
❌ Error: Network Error
```
**Fix:**
- Check backend đang chạy: `http://localhost:3000`
- Check CORS enabled ở backend

### Issue 2: "401 Unauthorized"
```
❌ Error: 401 Unauthorized
```
**Fix:**
- Check wallet address trong localStorage
- Check backend authentication middleware

### Issue 3: "Cannot find module"
```
Cannot find module 'axios'
```
**Fix:**
```bash
npm install axios
```

---

## 📊 SWITCH BETWEEN MOCK/REAL

### Cách 1: Environment Variable
```env
# .env
VITE_USE_MOCK_API=true   # Mock
VITE_USE_MOCK_API=false  # Real
```

### Cách 2: Code (Quick Test)
```typescript
// src/app/config/api.config.ts
export const API_CONFIG = {
  useMock: true,  // Force mock
  // useMock: false,  // Force real
  // useMock: import.meta.env.VITE_USE_MOCK_API === 'true',  // Dynamic
};
```

---

## ✅ CHECKLIST

Trước khi chạy Real API:

- [ ] Backend đang chạy
- [ ] CORS configured
- [ ] Endpoints return đúng JSON format
- [ ] Authentication works
- [ ] `.env` file có `VITE_USE_MOCK_API=false`
- [ ] `npm install axios` đã chạy
- [ ] Files `apiClient.ts`, `api.config.ts` đã tạo
- [ ] Hooks đã update

---

## 🎯 SUMMARY

**Files cần tạo:**
1. `.env`
2. `/src/app/config/api.config.ts`
3. `/src/app/services/apiClient.ts`

**Files cần update:**
1. `/src/app/hooks/useProposals.ts` (thêm real API logic)

**Command:**
```bash
npm install axios
npm run dev
```

**Check console:**
- Mock mode: `📦 Using Mock Data`
- Real mode: `🚀 API: GET /proposals`

---

**Đọc full guide:** [MIGRATION_TO_REAL_API.md](MIGRATION_TO_REAL_API.md)
