import { useState, useEffect } from 'react';

export interface Proposal {
  _id: string;
  tokenSymbol: string;
  tokenName: string;
  tokenAddress: string;
  title: string;
  summary: string;
  action: 'BUY' | 'SELL';
  
  // Financial Impact
  financialImpact: {
    currentValue: number;
    projectedValue: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  
  // Social Sentiment (from Twitter/X only)
  confidence: number; // 0-100
  sentimentType: 'positive' | 'negative' | 'neutral';
  sentimentScore: number; // -100 to 100
  
  // AI Reasoning
  reason: string[]; // Array of bullet points
  rationaleSummary: string; // Short intro summary
  
  // Sources (Twitter URLs)
  sources: string[]; // Array of tweet URLs
  triggerEventId: string; // Reference to original Signal
  
  // Legacy fields (for compatibility)
  currentPrice: number;
  targetPrice: number;
  aiReasoning: string;
  ecosystem: string;
  suggestedAmount: number;
  potentialReturn: number;
  timeHorizon: string;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  createdAt: string;
  expiresAt: string;
  status: 'PENDING' | 'EXECUTED' | 'EXPIRED';
}

// ==========================================
// TODO: Replace với API call tới MongoDB
// fetch('/api/proposals')
// ==========================================
const mockProposals: Proposal[] = [
  {
    _id: '1',
    tokenSymbol: 'SOL',
    tokenName: 'Solana',
    tokenAddress: 'So11111111111111111111111111111111111111112',
    title: 'Strong Breakout and Volume Spike in SOL',
    summary: 'Solana has shown a strong technical breakout above key resistance at $140, accompanied by a volume spike indicating institutional accumulation. Network activity has increased by 45% in the last 7 days.',
    action: 'BUY',
    currentPrice: 142.50,
    targetPrice: 165.00,
    financialImpact: {
      currentValue: 142.50,
      projectedValue: 165.00,
      riskLevel: 'MEDIUM',
    },
    confidence: 87,
    sentimentType: 'positive',
    sentimentScore: 75,
    reason: [
      'Strong technical breakout above key resistance at $140.',
      'Volume spike indicates institutional accumulation.',
      'Network activity up 45% in last 7 days.',
    ],
    rationaleSummary: 'Solana has shown a strong technical breakout above key resistance at $140, accompanied by a volume spike indicating institutional accumulation. Network activity has increased by 45% in the last 7 days.',
    sources: [
      'https://twitter.com/anonymized/status/1234567890',
    ],
    triggerEventId: 'volume-alert',
    aiReasoning: 'Strong technical breakout above key resistance at $140. Volume spike indicates institutional accumulation. Network activity up 45% in last 7 days.',
    ecosystem: 'Solana',
    suggestedAmount: 500,
    potentialReturn: 15.79,
    timeHorizon: '7-14 days',
    marketCap: 68500000000,
    volume24h: 3200000000,
    priceChange24h: 5.2,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 604800000).toISOString(),
    status: 'PENDING',
  },
  {
    _id: '2',
    tokenSymbol: 'JUP',
    tokenName: 'Jupiter',
    tokenAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    title: 'Major DEX Upgrade Announced for JUP',
    summary: 'Jupiter is about to take off with a major DEX upgrade, leading to a 230% increase in trading volume post-announcement. Strong community sentiment and developer activity are also contributing to the bullish outlook.',
    action: 'BUY',
    currentPrice: 0.845,
    targetPrice: 1.20,
    financialImpact: {
      currentValue: 0.845,
      projectedValue: 1.20,
      riskLevel: 'LOW',
    },
    confidence: 92,
    sentimentType: 'positive',
    sentimentScore: 90,
    reason: [
      'Major DEX upgrade announced.',
      'Trading volume up 230% post-announcement.',
      'Strong community sentiment and developer activity.',
    ],
    rationaleSummary: 'Jupiter is about to take off with a major DEX upgrade, leading to a 230% increase in trading volume post-announcement. Strong community sentiment and developer activity are also contributing to the bullish outlook.',
    sources: [
      'https://twitter.com/anonymized/status/1234567891',
    ],
    triggerEventId: 'x-scraper',
    aiReasoning: 'Major DEX upgrade announced. Trading volume up 230% post-announcement. Strong community sentiment and developer activity.',
    ecosystem: 'Solana',
    suggestedAmount: 300,
    potentialReturn: 42.01,
    timeHorizon: '14-21 days',
    marketCap: 1200000000,
    volume24h: 180000000,
    priceChange24h: 12.8,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    expiresAt: new Date(Date.now() + 1209600000).toISOString(),
    status: 'PENDING',
  },
  {
    _id: '3',
    tokenSymbol: 'BONK',
    tokenName: 'Bonk',
    tokenAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    title: 'Overbought and Whale Distribution in BONK',
    summary: 'BONK is currently overbought on RSI, with whale wallets showing distribution patterns. Social media hype is declining, indicating a bearish sentiment.',
    action: 'SELL',
    currentPrice: 0.000028,
    targetPrice: 0.000020,
    financialImpact: {
      currentValue: 0.000028,
      projectedValue: 0.000020,
      riskLevel: 'HIGH',
    },
    confidence: 78,
    sentimentType: 'negative',
    sentimentScore: -60,
    reason: [
      'Overbought on RSI.',
      'Whale wallets showing distribution patterns.',
      'Social media hype declining.',
    ],
    rationaleSummary: 'BONK is currently overbought on RSI, with whale wallets showing distribution patterns. Social media hype is declining, indicating a bearish sentiment.',
    sources: [
      'https://twitter.com/anonymized/status/1234567892',
    ],
    triggerEventId: 'whale-movement',
    aiReasoning: 'Overbought on RSI. Whale wallets showing distribution patterns. Social media hype declining.',
    ecosystem: 'Solana',
    suggestedAmount: 200,
    potentialReturn: -28.57,
    timeHorizon: '3-5 days',
    marketCap: 1800000000,
    volume24h: 85000000,
    priceChange24h: -3.5,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    expiresAt: new Date(Date.now() + 172800000).toISOString(),
    status: 'PENDING',
  },
  {
    _id: '4',
    tokenSymbol: 'RAY',
    tokenName: 'Raydium',
    tokenAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    title: 'Increasing TVL and New Liquidity Pools in RAY',
    summary: 'Raydium is experiencing steady growth in TVL, with new liquidity pools attracting capital. Technical analysis shows a bullish divergence, indicating a strong buying opportunity.',
    action: 'BUY',
    currentPrice: 3.45,
    targetPrice: 4.80,
    financialImpact: {
      currentValue: 3.45,
      projectedValue: 4.80,
      riskLevel: 'MEDIUM',
    },
    confidence: 85,
    sentimentType: 'positive',
    sentimentScore: 75,
    reason: [
      'TVL increasing steadily.',
      'New liquidity pools attracting capital.',
      'Technical analysis shows bullish divergence.',
    ],
    rationaleSummary: 'Raydium is experiencing steady growth in TVL, with new liquidity pools attracting capital. Technical analysis shows a bullish divergence, indicating a strong buying opportunity.',
    sources: [
      'https://twitter.com/anonymized/status/1234567893',
    ],
    triggerEventId: 'volume-alert',
    aiReasoning: 'TVL increasing steadily. New liquidity pools attracting capital. Technical analysis shows bullish divergence.',
    ecosystem: 'Solana',
    suggestedAmount: 400,
    potentialReturn: 39.13,
    timeHorizon: '10-14 days',
    marketCap: 890000000,
    volume24h: 95000000,
    priceChange24h: 7.3,
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    expiresAt: new Date(Date.now() + 1209600000).toISOString(),
    status: 'PENDING',
  },
];

export function useProposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProposals = async () => {
      try {
        setLoading(true);
        
        // TODO: Replace với real API call
        // const response = await fetch('/api/proposals');
        // const data = await response.json();
        // setProposals(data);
        
        await new Promise(resolve => setTimeout(resolve, 800));
        setProposals(mockProposals);
        setError(null);
      } catch (err) {
        setError('Failed to fetch proposals');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProposals();
  }, []);

  return { proposals, loading, error };
}

export function useProposal(id: string) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProposal = async () => {
      try {
        setLoading(true);
        
        // TODO: Replace với real API call
        // const response = await fetch(`/api/proposals/${id}`);
        // const data = await response.json();
        // setProposal(data);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        const found = mockProposals.find(p => p._id === id);
        setProposal(found || null);
        setError(null);
      } catch (err) {
        setError('Failed to fetch proposal');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProposal();
  }, [id]);

  return { proposal, loading, error };
}