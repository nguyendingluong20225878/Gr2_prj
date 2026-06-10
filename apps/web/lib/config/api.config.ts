export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api',
  useMock: process.env.NEXT_PUBLIC_USE_MOCK_API === 'true',
  timeout: 30000,
  
  endpoints: {
    auth: {
      verify: '/auth/verify',
      login: '/auth/login',
      logout: '/auth/logout',
    },
    
    user: {
      profile: '/user/profile',
      create: '/user/create',
      update: '/user/profile',
    },
    
    proposals: {
      list: '/proposals',
      detail: (id: string) => `/proposals/${id}`,
      filter: '/proposals/filter',
    },
    
    trades: {
      execute: '/trade/execute',
      history: '/trades/history',
    },
    
    portfolio: {
      summary: '/portfolio',
      holdings: '/portfolio/holdings',
    },
    
    signals: {
      detail: (id: string) => `/signals/${id}`,
    },
  },
};
