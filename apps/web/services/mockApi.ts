export type MockPricePoint = {
  timestamp: string;
  price: number;
};

export type MockTradePreview = {
  recommendedSizeUsd: number;
  maxLossUsd: number;
  riskPerTradePct: number;
  stopLossPct: number;
  notionalUsd: number;
  leverage: number;
};

export type MockAlert = {
  id: string;
  tokenSymbol: string;
  title: string;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: string;
  expiresAt?: string;
};

export type MockWatchlistItem = {
  id: string;
  proposalId: string;
  tokenSymbol: string;
  title: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
};

const now = Date.now();

export async function getMockPriceHistory(tokenSymbol: string): Promise<MockPricePoint[]> {
  const seed = tokenSymbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Array.from({ length: 24 }, (_, index) => {
    const drift = Math.sin((index + seed) / 3) * 3 + index * 0.35;
    return {
      timestamp: new Date(now - (24 - index) * 60 * 60 * 1000).toISOString(),
      price: Math.max(0.01, 20 + seed * 0.12 + drift),
    };
  });
}

export async function previewTrade(input: {
  amountUsd?: number;
  leverage?: number;
  pnlPercentage?: number | null;
}): Promise<MockTradePreview> {
  const amount = Math.max(10, Number(input.amountUsd ?? 100));
  const leverage = Math.max(1, Number(input.leverage ?? 1));
  const riskPerTradePct = 1;
  const stopLossPct = 5;
  return {
    recommendedSizeUsd: amount,
    maxLossUsd: Number(((amount * stopLossPct) / 100).toFixed(2)),
    riskPerTradePct,
    stopLossPct,
    notionalUsd: Number((amount * leverage).toFixed(2)),
    leverage,
  };
}

export async function getMockAlerts(): Promise<MockAlert[]> {
  return [
    {
      id: 'alert-expiring-signal',
      tokenSymbol: 'SOL',
      title: 'Signal SOL sắp hết hạn',
      status: 'ACTIVE',
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

export async function getMockWatchlist(): Promise<MockWatchlistItem[]> {
  return [
    {
      id: 'watch-sol',
      proposalId: 'mock-sol',
      tokenSymbol: 'SOL',
      title: 'Theo dõi vùng Entry SOL',
      reason: 'Theo dõi đề xuất, chưa vào lệnh',
      createdAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(now + 20 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
