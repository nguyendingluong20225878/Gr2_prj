import { useState, useEffect } from 'react';

export interface Trade {
  _id: string;
  proposalId: string;
  tokenSymbol: string;
  tokenName: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  amount: number;
  usdValue: number;
  profitLoss: number;
  profitLossPercent: number;
  executedAt: string;
  status: 'OPEN' | 'CLOSED';
  txSignature?: string;
}

export interface PortfolioStats {
  totalValue: number;
  totalInvested: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  winRate: number;
  totalTrades: number;
}

// ==========================================
// TODO: Replace với API call tới MongoDB
// fetch('/api/portfolio')
// ==========================================
const mockTrades: Trade[] = [
  {
    _id: 't1',
    proposalId: '1',
    tokenSymbol: 'JUP',
    tokenName: 'Jupiter',
    action: 'BUY',
    entryPrice: 0.75,
    currentPrice: 0.845,
    amount: 400,
    usdValue: 338,
    profitLoss: 38,
    profitLossPercent: 12.67,
    executedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    status: 'OPEN',
    txSignature: '5wHu7z...',
  },
  {
    _id: 't2',
    proposalId: '2',
    tokenSymbol: 'SOL',
    tokenName: 'Solana',
    action: 'BUY',
    entryPrice: 138.20,
    currentPrice: 142.50,
    amount: 3.6,
    usdValue: 513,
    profitLoss: 15.48,
    profitLossPercent: 3.11,
    executedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'OPEN',
    txSignature: '3kLm9x...',
  },
  {
    _id: 't3',
    proposalId: '3',
    tokenSymbol: 'RAY',
    tokenName: 'Raydium',
    action: 'BUY',
    entryPrice: 2.85,
    currentPrice: 3.45,
    amount: 140,
    usdValue: 483,
    profitLoss: 84,
    profitLossPercent: 21.05,
    executedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    status: 'OPEN',
    txSignature: '7nPq2w...',
  },
  {
    _id: 't4',
    proposalId: '4',
    tokenSymbol: 'ORCA',
    tokenName: 'Orca',
    action: 'BUY',
    entryPrice: 3.20,
    currentPrice: 2.95,
    amount: 150,
    usdValue: 442.5,
    profitLoss: -37.5,
    profitLossPercent: -7.81,
    executedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    status: 'OPEN',
    txSignature: '9xYz4m...',
  },
];

const mockStats: PortfolioStats = {
  totalValue: 1776.5,
  totalInvested: 1676.52,
  totalProfitLoss: 99.98,
  totalProfitLossPercent: 5.96,
  winRate: 75,
  totalTrades: 4,
};

export function usePortfolio() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        
        // TODO: Replace với real API call
        // const response = await fetch('/api/portfolio');
        // const data = await response.json();
        // setTrades(data.trades);
        // setStats(data.stats);
        
        await new Promise(resolve => setTimeout(resolve, 800));
        setTrades(mockTrades);
        setStats(mockStats);
        setError(null);
      } catch (err) {
        setError('Failed to fetch portfolio');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  return { trades, stats, loading, error };
}