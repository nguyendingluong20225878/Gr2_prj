# 🚀 NDL AI - Next.js 15 App

**Crypto Portfolio Manager** với AI-powered trading signals trên Solana blockchain.

## 📦 Tech Stack

- **Frontend:** Next.js 15 (App Router) + React 19
- **Styling:** Tailwind CSS v4 + Cyberpunk Theme
- **Blockchain:** Solana Web3.js + Phantom Wallet
- **UI Components:** Radix UI + Shadcn
- **State:** React Context + Custom Hooks
- **API Client:** Axios
- **Database:** MongoDB (backend)

---

## 🎨 Theme

**Cyberpunk Glassmorphism** với màu chủ đạo:
- Purple: `#a855f7`
- Cyan: `#06b6d4`
- Pink: `#ec4899`

---

## 📁 Project Structure

```
/
├── app/
│   ├── components/       # React Client Components
│   │   ├── ui/          # Shadcn UI components
│   │   ├── wallet/      # Wallet Provider
│   │   ├── dashboard/   # Dashboard components
│   │   ├── proposal/    # Proposal detail components
│   │   └── portfolio/   # Portfolio components
│   ├── contexts/        # React Contexts (Auth)
│   ├── dashboard/       # Dashboard page
│   ├── onboarding/      # Onboarding page
│   ├── portfolio/       # Portfolio page
│   ├── profile/         # Profile settings page
│   ├── proposal/[id]/   # Dynamic proposal detail page
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Landing page
│   └── globals.css      # Global styles
│
├── lib/
│   ├── api/            # API client (Axios)
│   ├── config/         # Configuration files
│   ├── hooks/          # Custom React hooks
│   └── utils/          # Utility functions
│
├── public/             # Static assets
├── API_DOCS.md         # API integration guide
├── next.config.js      # Next.js configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Dependencies
```

---

## ⚙️ Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Environment File
```bash
cp .env.example .env.local
```

### 3. Configure Environment Variables
Edit `.env.local`:
```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_USE_MOCK_API=true

# Solana Configuration
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

### 4. Run Development Server
```bash
npm run dev
```

App sẽ chạy tại: **http://localhost:3000**

---

## 🎯 Features

### 1. **Landing Page** (`/`)
- Hero section với nút "Connect Wallet"
- Features showcase
- Footer

### 2. **Dashboard** (`/dashboard`)
- AI trading signals (BUY/SELL proposals)
- Filter by action type
- Social sentiment indicators
- Real-time confidence scores

### 3. **Proposal Detail** (`/proposal/[id]`)
- Chi tiết tín hiệu trading
- Evidence từ Twitter/X
- Chain of Thought reasoning
- Execute trade functionality

### 4. **Portfolio** (`/portfolio`)
- Total portfolio value & P/L
- Holdings breakdown
- Recent trades history
- Performance charts

### 5. **Profile Settings** (`/profile`)
- User information
- Risk tolerance settings
- Trading style preferences
- Notification settings

### 6. **Onboarding** (`/onboarding`)
- New user registration
- Profile setup
- Risk assessment

---

## 🔐 Authentication Flow

```
1. User clicks "Connect Wallet" on Landing Page
2. Phantom wallet modal opens
3. User approves connection
4. App calls POST /api/auth/verify with walletAddress
5. If new user → redirect to /onboarding
6. If existing user → redirect to /dashboard
```

---

## 📡 API Integration

### Mock Data Mode (Development)
```bash
NEXT_PUBLIC_USE_MOCK_API=true npm run dev
```

### Real API Mode (Production)
```bash
NEXT_PUBLIC_USE_MOCK_API=false npm run dev
```

Chi tiết API endpoints xem file: **[API_DOCS.md](./API_DOCS.md)**

---

## 🚀 Deployment

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Environment Variables on Vercel
Thêm các biến môi trường trên Vercel Dashboard:
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_USE_MOCK_API`
- `NEXT_PUBLIC_SOLANA_NETWORK`

---

## 🔧 Development Notes

### Server Components vs Client Components

**Server Components** (mặc định):
- `/app/page.tsx`
- `/app/layout.tsx`
- Không có `'use client'` directive

**Client Components** (cần `'use client'`):
- Tất cả components trong `/app/components/*`
- Components sử dụng hooks (useState, useEffect, etc.)
- Components với event handlers (onClick, onChange, etc.)
- Components sử dụng browser APIs (localStorage, window, etc.)

### Wallet Integration

App sử dụng **@solana/wallet-adapter-react** với:
- Phantom Wallet support
- Devnet network
- Auto-connect disabled (user manually connects)

### Styling

- Tailwind CSS v4 với custom theme
- CSS variables cho colors
- Cyberpunk glassmorphism effects
- Custom animations (float, pulse-glow, scan)

---

## 📚 Key Libraries

```json
{
  "next": "^15.1.6",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "@solana/web3.js": "^1.98.4",
  "@solana/wallet-adapter-react": "^0.15.39",
  "axios": "^1.7.9",
  "recharts": "2.15.2",
  "lucide-react": "0.487.0",
  "tailwindcss": "^4.1.12"
}
```

---

## 🐛 Troubleshooting

### Build Errors
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Rebuild
npm run build
```

### Wallet Connection Issues
- Ensure Phantom extension is installed
- Check browser console for errors
- Try disabling other wallet extensions

### API Errors
- Check if backend is running
- Verify `NEXT_PUBLIC_API_BASE_URL`
- Check CORS configuration on backend

---

## 📖 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/)

---

## 📞 Support

For issues or questions, check the [API_DOCS.md](./API_DOCS.md) file.

---

**Happy coding! 🚀**
