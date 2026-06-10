import type { ProposalUI } from '@/lib/types';
import type { SignalUI } from '@/lib/hooks/useSignals';

export type DemoRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type DemoAction = 'BUY' | 'SELL' | 'HOLD';

export interface DemoToken {
  address: string;
  name: string;
  priceUsd: number;
  symbol: string;
}

export interface DemoPortfolioSnapshot {
  equityUsd: number;
  exposureUsd: number;
  dailyPnlPct: number;
  status: 'DEMO_MODE';
}

export interface DemoScenario {
  alerts: Array<{
    id: string;
    proposalId?: string;
    severity: DemoRiskLevel;
    status: 'new' | 'acknowledged' | 'resolved';
    title: string;
    tokenSymbol: string;
  }>;
  portfolio: DemoPortfolioSnapshot;
  proposals: ProposalUI[];
  signals: SignalUI[];
  tokens: DemoToken[];
}

const now = Date.now();
const hours = (value: number) => new Date(now + value * 60 * 60 * 1000).toISOString();

export const demoScenario: DemoScenario = {
  tokens: [
    { address: 'So11111111111111111111111111111111111111112', name: 'Solana', priceUsd: 168.48, symbol: 'SOL' },
    { address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', name: 'Jupiter', priceUsd: 1.14, symbol: 'JUP' },
    { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzL9tDq9nM25bK', name: 'dogwifhat', priceUsd: 2.62, symbol: 'WIF' },
  ],
  signals: [
    {
      _id: 'demo-signal-sol-volatility',
      confidence: 78,
      detectedAt: hours(-2),
      enrichedProposal: {
        _id: 'demo-proposal-sol-long',
        action: 'BUY',
        backtest: {
          actualPnlUsd: 214.5,
          dataQuality: 'SIMULATED_CACHE',
          feePct: 0.06,
          grossPnlPct: 5.1,
          label: 'Mean reversion replay',
          netPnlPct: 4.72,
          outcome: 'WIN',
          severity: 'LOW',
          slippagePct: 0.09,
        },
        confidence: 78,
        pnlPercentage: 4.72,
        quantScore: 2.34,
        rationaleSummary: 'SOL volatility expanded while price stayed above short-term support. Demo thesis favors a controlled long with tight invalidation.',
        scoreComponents: { crossZ: 1.91, finalScore: 2.34, pureAlphaZ: 2.18, timeZ: 1.47, unifiedRaw: 2.02 },
        status: 'active',
        suggestionType: 'buy',
        tokenSymbol: 'SOL',
        volatilityFlag: 0.74,
        winLossStatus: 'WIN',
      },
      expiresAt: hours(10),
      quantScore: 2.34,
      rationaleSummary: 'SOL volatility spike with positive quant confirmation.',
      sentimentType: 'positive',
      sources: [{ label: 'Demo market tape', url: 'https://solana.com' }],
      status: 'active',
      suggestionType: 'buy',
      tokenAddress: 'So11111111111111111111111111111111111111112',
      tokenSymbol: 'SOL',
    },
    {
      _id: 'demo-signal-jup-mean-reversion',
      confidence: 64,
      detectedAt: hours(-5),
      enrichedProposal: {
        _id: 'demo-proposal-jup-wait',
        action: 'HOLD',
        confidence: 64,
        pnlPercentage: 1.2,
        quantScore: 1.08,
        rationaleSummary: 'JUP is close to a mean-reversion zone, but confirmation is not strong enough for execution.',
        scoreComponents: { crossZ: 0.82, finalScore: 1.08, pureAlphaZ: 1.11, timeZ: 0.66, unifiedRaw: 0.94 },
        status: 'pending',
        suggestionType: 'hold',
        tokenSymbol: 'JUP',
        volatilityFlag: 0.39,
      },
      expiresAt: hours(6),
      quantScore: 1.08,
      rationaleSummary: 'JUP setup is watchlist-only until confirmation improves.',
      sentimentType: 'neutral',
      sources: [{ label: 'Demo liquidity monitor', url: 'https://jup.ag' }],
      status: 'active',
      suggestionType: 'hold',
      tokenAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      tokenSymbol: 'JUP',
    },
    {
      _id: 'demo-signal-wif-risk-off',
      confidence: 52,
      detectedAt: hours(-1),
      enrichedProposal: {
        _id: 'demo-proposal-wif-short',
        action: 'SELL',
        backtest: {
          actualPnlUsd: -86.2,
          dataQuality: 'SIMULATED_CACHE',
          feePct: 0.08,
          grossPnlPct: -2.7,
          label: 'Momentum failure replay',
          netPnlPct: -2.93,
          outcome: 'LOSS',
          severity: 'HIGH',
          slippagePct: 0.15,
        },
        confidence: 52,
        pnlPercentage: -2.93,
        quantScore: -1.64,
        rationaleSummary: 'WIF momentum is fragile and volatility is elevated. Treat as risk-reduction, not aggressive short sizing.',
        scoreComponents: { crossZ: -1.45, finalScore: -1.64, pureAlphaZ: -1.2, timeZ: -1.78, unifiedRaw: -1.5 },
        status: 'active',
        suggestionType: 'sell',
        tokenSymbol: 'WIF',
        volatilityFlag: 0.91,
        winLossStatus: 'LOSS',
      },
      expiresAt: hours(4),
      quantScore: -1.64,
      rationaleSummary: 'WIF high-risk momentum failure with volatility interrupt.',
      sentimentType: 'negative',
      sources: [{ label: 'Demo volatility monitor', url: 'https://birdeye.so' }],
      status: 'active',
      suggestionType: 'sell',
      tokenAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzL9tDq9nM25bK',
      tokenSymbol: 'WIF',
    },
  ],
  proposals: [
    {
      _id: 'demo-proposal-sol-long',
      action: 'BUY',
      confidence: 78,
      createdAt: hours(-2),
      expiresAt: hours(10),
      financialImpact: { currentValue: 168.48, projectedValue: 176.43, riskLevel: 'MEDIUM', roi: 4.72, percentChange: 4.72 },
      reason: [
        'Reason: volatility expanded but SOL remains above short-term support.',
        'Risk: invalid if price loses the local support band.',
        'Suggested Action: enter demo long with reduced size and stop discipline.',
      ],
      sentimentScore: 62,
      sentimentType: 'positive',
      sources: ['https://solana.com'],
      status: 'active',
      summary: 'SOL shows a medium-risk continuation setup suitable for a controlled demo execution.',
      title: 'SOL controlled long after volatility expansion',
      tokenName: 'Solana',
      tokenSymbol: 'SOL',
    },
    {
      _id: 'demo-proposal-jup-wait',
      action: 'HOLD',
      confidence: 64,
      createdAt: hours(-5),
      expiresAt: hours(6),
      financialImpact: { currentValue: 1.14, projectedValue: 1.18, riskLevel: 'LOW', roi: 1.2, percentChange: 1.2 },
      reason: ['Reason: mean reversion is forming.', 'Risk: confirmation is weak.', 'Suggested Action: wait for stronger volume.'],
      sentimentScore: 8,
      sentimentType: 'neutral',
      sources: ['https://jup.ag'],
      status: 'pending',
      summary: 'JUP remains a watchlist candidate, not an execution candidate.',
      title: 'JUP wait for confirmation',
      tokenName: 'Jupiter',
      tokenSymbol: 'JUP',
    },
    {
      _id: 'demo-proposal-wif-short',
      action: 'SELL',
      confidence: 52,
      createdAt: hours(-1),
      expiresAt: hours(4),
      financialImpact: { currentValue: 2.62, projectedValue: 2.48, riskLevel: 'HIGH', roi: -2.93, percentChange: -2.93 },
      reason: [
        'Reason: momentum is fading while volatility is elevated.',
        'Risk: backtest replay is negative.',
        'Suggested Action: reject or use only as risk-off alert.',
      ],
      sentimentScore: -41,
      sentimentType: 'negative',
      sources: ['https://birdeye.so'],
      status: 'active',
      summary: 'WIF is a high-risk signal used to demonstrate alerting and rejection discipline.',
      title: 'WIF risk-off momentum warning',
      tokenName: 'dogwifhat',
      tokenSymbol: 'WIF',
    },
  ],
  alerts: [
    {
      id: 'demo-alert-wif-volatility',
      proposalId: 'demo-proposal-wif-short',
      severity: 'HIGH',
      status: 'new',
      title: 'WIF volatility above demo threshold',
      tokenSymbol: 'WIF',
    },
  ],
  portfolio: {
    dailyPnlPct: 0.84,
    equityUsd: 10000,
    exposureUsd: 0,
    status: 'DEMO_MODE',
  },
};

export function findDemoProposal(id: string): ProposalUI | undefined {
  return demoScenario.proposals.find((proposal) => proposal._id === id);
}
