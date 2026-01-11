/**
 * Mock API Service for Development
 * 
 * This simulates API calls using localStorage for data persistence.
 * In production, these will be replaced with real API routes.
 * 
 * NOTE: When migrating to Monorepo with @gr2/shared:
 * - Remove this file
 * - Use real Next.js API routes in apps/web/src/app/api/
 * - Import User model from @gr2/shared
 */

interface User {
  _id: string;
  email: string;
  name?: string;
  walletAddress: string;
  age?: number;
  riskTolerance: string;
  tradeStyle?: string;
  totalAssetUsd?: number;
  cryptoInvestmentUsd?: number;
  image?: string;
  notificationEnabled: boolean;
  balances: any[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'ndl_users';

// Get all users from localStorage
function getUsers(): User[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

// Save users to localStorage
function saveUsers(users: User[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

// Generate unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Mock: POST /api/auth/verify
 * Check if wallet address exists in database
 */
export async function mockAuthVerify(walletAddress: string) {
  console.log('🔍 [Mock API] Verifying wallet:', walletAddress);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  const users = getUsers();
  console.log('👥 [Mock API] Total users in storage:', users.length);
  
  const user = users.find(u => u.walletAddress === walletAddress);

  if (!user) {
    console.log('❌ [Mock API] User not found - requires onboarding');
    return {
      exists: false,
      requiresOnboarding: true,
    };
  }

  console.log('✅ [Mock API] User found:', user.email);
  return {
    exists: true,
    requiresOnboarding: false,
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
      walletAddress: user.walletAddress,
      riskTolerance: user.riskTolerance,
      tradeStyle: user.tradeStyle,
      totalAssetUsd: user.totalAssetUsd,
      cryptoInvestmentUsd: user.cryptoInvestmentUsd,
      image: user.image,
      notificationEnabled: user.notificationEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  };
}

/**
 * Mock: POST /api/user/create
 * Create new user account
 */
export async function mockUserCreate(data: {
  walletAddress: string;
  email: string;
  name?: string;
  age?: number;
  tradeStyle?: string;
  totalAssetUsd?: number;
  cryptoInvestmentUsd?: number;
  riskTolerance?: string;
}) {
  console.log('📝 [Mock API] Creating new user:', data.email);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const users = getUsers();

  // Check duplicate email
  if (users.find(u => u.email === data.email)) {
    console.log('❌ [Mock API] Email already registered');
    throw new Error('Email already registered');
  }

  // Check duplicate wallet
  if (users.find(u => u.walletAddress === data.walletAddress)) {
    console.log('❌ [Mock API] Wallet already registered');
    throw new Error('Wallet already registered');
  }

  // Create new user
  const newUser: User = {
    _id: generateId(),
    email: data.email,
    name: data.name || '',
    walletAddress: data.walletAddress,
    age: data.age,
    riskTolerance: data.riskTolerance || 'medium',
    tradeStyle: data.tradeStyle || '',
    totalAssetUsd: data.totalAssetUsd || 0,
    cryptoInvestmentUsd: data.cryptoInvestmentUsd || 0,
    image: '',
    notificationEnabled: false,
    balances: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  console.log('✅ [Mock API] User created successfully:', newUser._id);
  console.log('👥 [Mock API] Total users now:', users.length);

  return {
    success: true,
    user: {
      _id: newUser._id,
      email: newUser.email,
      walletAddress: newUser.walletAddress,
    }
  };
}

/**
 * Mock: GET /api/user/profile?wallet=...
 * Get user profile by wallet address
 */
export async function mockUserProfile(walletAddress: string) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));

  const users = getUsers();
  const user = users.find(u => u.walletAddress === walletAddress);

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

/**
 * Mock: PATCH /api/user/profile
 * Update user profile
 */
export async function mockUserUpdate(walletAddress: string, updates: Partial<User>) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 400));

  const users = getUsers();
  const userIndex = users.findIndex(u => u.walletAddress === walletAddress);

  if (userIndex === -1) {
    throw new Error('User not found');
  }

  // Check if email changed and is duplicate
  if (updates.email && updates.email !== users[userIndex].email) {
    const emailExists = users.find(u => u.email === updates.email);
    if (emailExists) {
      throw new Error('Email already in use');
    }
  }

  // Update user (exclude walletAddress and email from updates)
  const { walletAddress: _, email: __, ...allowedUpdates } = updates as any;
  
  users[userIndex] = {
    ...users[userIndex],
    ...allowedUpdates,
    updatedAt: new Date().toISOString(),
  };

  saveUsers(users);

  return {
    success: true,
    user: users[userIndex]
  };
}

/**
 * Setup mock API interceptor
 * Intercepts fetch calls to /api/* and routes to mock functions
 */
export function setupMockApi() {
  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // Only intercept /api/* calls
    if (!url.startsWith('/api/')) {
      return originalFetch(input, init);
    }

    try {
      let result: any;
      
      // Auth verify
      if (url === '/api/auth/verify' && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        result = await mockAuthVerify(body.walletAddress);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // User create
      if (url === '/api/user/create' && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        result = await mockUserCreate(body);
        return new Response(JSON.stringify(result), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // User profile GET
      if (url.startsWith('/api/user/profile?wallet=')) {
        const walletAddress = new URL(url, window.location.origin).searchParams.get('wallet');
        if (!walletAddress) {
          throw new Error('Wallet address required');
        }
        result = await mockUserProfile(walletAddress);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // User profile PATCH
      if (url === '/api/user/profile' && init?.method === 'PATCH') {
        const body = JSON.parse(init.body as string);
        result = await mockUserUpdate(body.walletAddress, body.updates);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Fallback to real fetch
      return originalFetch(input, init);

    } catch (error) {
      // Return error response
      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };

  console.log('✅ Mock API initialized (Development Mode)');
}