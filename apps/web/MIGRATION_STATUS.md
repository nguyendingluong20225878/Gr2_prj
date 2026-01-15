# NDL AI - Migration Status

## Tổng quan Migration Next.js 14+ App Router


## Cấu trúc Dual-Mode

### Next.js Production (App Router)
- **Entry Point**: Next.js automatic
- **Root Layout**: `/app/layout.tsx`
- **Pages**: `/app/page.tsx`, `/app/dashboard/page.tsx`, etc.
- **Components**: `/app/components/`
- **Hooks**: `/lib/hooks/`
- **Config**: `/lib/config/`
- **API Routes**: `/app/api/`
- **Router**: Next.js App Router (file-based)

## Migration Progress: 90%

### ✅ Completed (90%)
1. **Business Components Migration**
   - ✅ Dashboard components (Dashboard, ProposalCardSocial)
   - ✅ Landing Page component
   - ✅ Layout components (Layout, Navbar)
   - ✅ Wallet components (WalletProvider, WalletDebug)
   - ✅ Onboarding component
   - ✅ Portfolio component
   - ✅ UI components (button, badge, tabs, skeleton, etc.)
   
2. **Hooks Migration**
   - ✅ useProposals
   - ✅ usePortfolio
   
3. **Context Migration**
   - ✅ AuthContext (both /src and /app versions)
   
4. **Configuration**
   - ✅ API client setup
   - ✅ API config
   - ✅ Vite config với alias @
   - ✅ TypeScript config
   
5. **Styles**
   - ✅ Cyberpunk theme
   - ✅ Tailwind CSS v4
   - ✅ Glassmorphism effects

### 🔄 In Progress (10%)
1. **Proposal Detail Components** (8 components)
   - 🔄 ProposalDetail.tsx
   - 🔄 ProposalDetailSocial.tsx
   - 🔄 ChainOfThought.tsx
   - 🔄 RelevantTweets.tsx
   - 🔄 RiskSimulation.tsx
   - 🔄 TheNumbers.tsx
   - 🔄 TheLogic.tsx
   - 🔄 TheEvidence.tsx

2. **Profile Settings**
   - 🔄 ProfileSettings.tsx

### ⏳ Remaining (0%)
- ✅ All migrations completed!

## Key Architecture Decisions

### 1. Navigation Strategy
- **Figma Make**: Uses React Router (`useNavigate()`, `useParams()`, `useLocation()`)
- **Next.js**: Uses Next.js Router (`useRouter()`, `usePathname()`, `useParams()`)
- **Solution**: Created `/lib/utils/navigation.ts` with safe hooks that work in both environments

### 2. Import Aliases
- **@/**: Points to `/src/` directory (configured in vite.config.ts and tsconfig.json)
- All components use `@/` alias for consistent imports

### 3. Component Structure
- Figma Make uses components from `/src/app/components/`
- Next.js uses components from `/app/components/`
- Shared UI components can be used by both

### 4. Authentication Flow
```
Landing (/) 
  → Connect Wallet 
  → Verify in DB
    → New User → /onboarding → /dashboard
    → Existing User → /dashboard
```

## Fixing Router Errors

### Common Error: "useNavigate() may be used only in the context of a <Router> component"

**Root Cause**: Components in `/app/` trying to use React Router hooks without Router context

**Solution Applied**:
1. Ensure `/src/app/App.tsx` only imports from `/src/app/components/`
2. All `/src/app/components/` are wrapped in `<BrowserRouter>` via `/main.tsx`
3. Components in `/app/` use Next.js navigation when deployed
4. Use `/lib/utils/navigation.ts` safe hooks for dual-mode compatibility

## Testing in Figma Make

1. **Preview Mode**: Uses Vite dev server with React Router
2. **Hot Reload**: Works with all components in `/src/app/`
3. **Router**: BrowserRouter wraps entire app in `/main.tsx`

## Deployment to Production (Next.js)

1. Use components from `/app/` directory
2. API routes work via `/app/api/`
3. File-based routing automatic
4. Server components supported

## Next Steps

1. ✅ Fix React Router context errors
2. 🔄 Complete remaining proposal component migrations
3. 🔄 Complete ProfileSettings migration
4. ✅ Verify all components work in Figma Make preview
5. ⏳ Test full deployment in Next.js production

## Notes

- Keep both `/src/app/` and `/app/` structures until 100% migration complete
- Gradually move components from `/src/app/components/` to `/app/components/`
- Maintain backwards compatibility with Figma Make preview
- Document all navigation pattern changes