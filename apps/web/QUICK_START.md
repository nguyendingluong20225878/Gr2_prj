# 🚀 NDL AI - Quick Start Guide

## ✨ Đã Sẵn Sàng Để Preview!

App của bạn đã được fix và configure hoàn chỉnh. Bạn có thể bắt đầu ngay!

## 🎯 Preview Trong Figma Make

### Bước 1: Click Preview
Chỉ cần click nút **Preview** trong Figma Make interface

### Bước 2: Test App
Khi app load, bạn sẽ thấy landing page với 2 options:

#### Option 1: Dev Mode (Recommended for Testing)
- Click **"Dev Mode - Skip to Dashboard"**
- App sẽ tự động tạo mock user và redirect vào Dashboard
- Bạn có thể test toàn bộ app mà không cần wallet

#### Option 2: Connect Wallet (Real Authentication)
- Click **"Connect Wallet"**
- Chọn Phantom wallet
- App sẽ verify wallet address trong database
- Nếu là user mới → redirect đến Onboarding
- Nếu là user cũ → redirect đến Dashboard

## 🗺️ Tính Năng Có Sẵn

### 1. Landing Page (`/`)
- Giant NDL branding
- Cyberpunk theme với purple-cyan gradient
- Connect wallet button
- Dev mode skip button

### 2. Dashboard (`/dashboard`)
- AI Command Center header
- Real-time proposals từ AI analysis
- Filter: ALL / BUY / SELL signals
- Proposal cards với:
  - Token information
  - AI confidence score
  - Price targets
  - Social sentiment
  - Risk level

### 3. Portfolio (`/portfolio`)
- Performance overview
- Open/Closed trades
- Profit/Loss tracking
- Asset allocation chart
- Trade history

### 4. Onboarding (`/onboarding`)
- Risk tolerance questionnaire
- Trading style selection
- Portfolio setup
- Notification preferences

### 5. Profile (`/profile`)
- User settings
- Risk tolerance adjustment
- Trading preferences
- Account management

### 6. Proposal Detail (`/proposal/:id`)
- Detailed AI analysis
- Chain of thought reasoning
- Relevant tweets
- Risk simulation
- Social sentiment analysis
- Evidence và logic

## 🎨 Theme Cyberpunk

### Colors Available
- `cyber-purple` - #a855f7
- `cyber-cyan` - #06b6d4
- `cyber-pink` - #ec4899
- `cyber-blue` - #3b82f6

### Special Classes
```tsx
<div className="glass-card">Glassmorphism effect</div>
<div className="neon-border">Neon border glow</div>
<div className="neon-glow">Neon glow effect</div>
<h1 className="gradient-text">Purple-Cyan gradient</h1>
```

## 🧪 Testing Scenarios

### Scenario 1: Quick Dashboard Preview
1. Click "Dev Mode - Skip to Dashboard"
2. See AI proposals loaded
3. Try filter buttons (ALL/BUY/SELL)
4. Click on a proposal card to see details

### Scenario 2: Full Authentication Flow
1. Click "Connect Wallet"
2. Connect with Phantom
3. Complete onboarding (if new user)
4. Navigate to Dashboard
5. Explore Portfolio
6. Check Profile settings

### Scenario 3: Portfolio Tracking
1. Go to Dashboard
2. Click proposal
3. Execute trade (simulated)
4. Go to Portfolio
5. See trade in "Open Trades"

## 🔧 Development Mode Features

### Mock Data
App có sẵn mock data cho:
- ✅ Proposals (AI trading signals)
- ✅ Portfolio trades
- ✅ User profile
- ✅ Social sentiment data

### Dev Tools
- Wallet debug panel (bottom-right corner)
- Console logs cho authentication flow
- Error boundaries cho better debugging

## 📱 Responsive Design

App hoạt động tốt trên:
- ✅ Desktop (1920px+)
- ✅ Laptop (1366px - 1920px)
- ✅ Tablet (768px - 1366px)
- ✅ Mobile (375px - 768px)

## 🎭 Navigation

### Automatic Routes
- `/` → Landing Page
- `/dashboard` → Dashboard
- `/portfolio` → Portfolio
- `/onboarding` → Onboarding
- `/profile` → Profile Settings
- `/proposal/:id` → Proposal Detail

### Navigation Methods
```tsx
// In components, use React Router
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
navigate('/dashboard'); // Go to dashboard
navigate('/proposal/123'); // Go to proposal detail
```

## 🔐 Authentication States

### Not Connected
- Shows landing page
- Only "Connect Wallet" available

### Connected (New User)
- Redirects to `/onboarding`
- Must complete profile setup
- Then redirects to `/dashboard`

### Connected (Existing User)
- Redirects to `/dashboard`
- Full app access
- Can navigate freely

## 💡 Pro Tips

### 1. Use Dev Mode for Quick Testing
Fastest way to see the app without wallet setup

### 2. Check Console for Debug Info
Useful logs for authentication and API calls

### 3. Try Different Routes Manually
Type `/dashboard`, `/portfolio`, etc. in the URL

### 4. Refresh Preserves State
Wallet connection and auth state persist across refreshes

## 🐛 Troubleshooting

### "Router context" Error?
✅ FIXED! App now properly wraps all components in Router context

### Wallet Not Connecting?
- Make sure Phantom wallet extension is installed
- Check that you're on Devnet (configured automatically)

### Styles Not Loading?
- Check that `/src/styles/index.css` is imported
- Verify Tailwind CSS is processing

### Routes Not Working?
- All routes are configured in `/src/app/App.tsx`
- Check that you're using correct paths

## 📊 Data Flow

```
User Action
  ↓
Component (React Router)
  ↓
Custom Hook (useProposals, usePortfolio)
  ↓
API Client (Mock data for now)
  ↓
Component Updates
  ↓
UI Renders
```

## 🎯 What's Working

- ✅ All routes configured
- ✅ Router context fixed
- ✅ Wallet integration ready
- ✅ Authentication flow complete
- ✅ Cyberpunk theme active
- ✅ Mock data loaded
- ✅ Responsive design
- ✅ Error handling
- ✅ Loading states

## 🚀 Ready to Launch!

Your app is fully configured and ready for preview. Just click **Preview** in Figma Make!

---

**Need Help?**
- Check `/DEVELOPMENT_GUIDE.md` for detailed docs
- See `/FIXES_APPLIED.md` for what was fixed
- Review `/MIGRATION_STATUS.md` for architecture details

**Happy Testing! 🎉**
