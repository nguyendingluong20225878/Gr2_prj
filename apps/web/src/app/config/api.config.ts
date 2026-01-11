/**
 * API Configuration
 * Centralized API endpoint and configuration management
 */

export const API_CONFIG = {
  // Base URL - đọc từ environment variable
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  
  // Mock mode - set true để dùng mock data, false để call real API
  useMock: import.meta.env.VITE_USE_MOCK_API === 'true',
  
  // Request timeout (30 seconds)
  timeout: 30000,
  
  // API Endpoints
  endpoints: {
    // Authentication
    auth: {
      verify: '/auth/verify',
      login: '/auth/login',
      logout: '/auth/logout',
    },
    
    // User Management
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

// Helper để log config (development only)
if (import.meta.env.DEV) {
  console.log('🔧 API Config:', {
    baseURL: API_CONFIG.baseURL,
    useMock: API_CONFIG.useMock,
    mode: API_CONFIG.useMock ? '📦 MOCK MODE' : '🚀 REAL API MODE',
  });
}
