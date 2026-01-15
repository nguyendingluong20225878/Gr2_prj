'use client';

import { useState } from 'react';
import { usePortfolio } from '@/lib/hooks/usePortfolio';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  DollarSign, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#a855f7', '#06b6d4', '#ec4899', '#3b82f6', '#22d3ee'];

export function Portfolio() {
  const { trades, stats, loading, error } = usePortfolio();
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('OPEN');

  const filteredTrades = trades.filter(t => 
    filter === 'ALL' ? true : t.status === filter
  );

  // Prepare data for pie chart
  const portfolioDistribution = trades.map((trade, index) => ({
    name: trade.tokenSymbol,
    value: trade.usdValue,
    color: COLORS[index % COLORS.length]
  }));

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 rounded-xl text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Error Loading Portfolio</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="glass-card rounded-xl p-8 neon-border">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-gradient-purple-cyan rounded-lg neon-glow">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold gradient-text">Portfolio</h1>
            <p className="text-muted-foreground">Track your trading performance</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Value */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">Total Value</p>
              </div>
              <p className="text-2xl font-bold">{formatNumber(stats.totalValue)}</p>
            </div>

            {/* Total Invested */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="h-5 w-5 text-secondary" />
                <p className="text-sm text-muted-foreground">Total Invested</p>
              </div>
              <p className="text-2xl font-bold">{formatNumber(stats.totalInvested)}</p>
            </div>

            {/* Profit/Loss */}
            <div className={`${stats.totalProfitLoss >= 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'} border rounded-lg p-4`}>
              <div className="flex items-center space-x-2 mb-2">
                {stats.totalProfitLoss >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-400" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-400" />
                )}
                <p className={`text-sm ${stats.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  Total P/L
                </p>
              </div>
              <p className={`text-2xl font-bold ${stats.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.totalProfitLoss >= 0 ? '+' : ''}{formatNumber(stats.totalProfitLoss)}
                <span className="text-sm ml-2">
                  ({stats.totalProfitLossPercent >= 0 ? '+' : ''}{stats.totalProfitLossPercent.toFixed(2)}%)
                </span>
              </p>
            </div>

            {/* Win Rate */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="h-5 w-5 text-accent-foreground" />
                <p className="text-sm text-muted-foreground">Win Rate</p>
              </div>
              <div className="flex items-center space-x-3">
                <p className="text-2xl font-bold">{stats.winRate}%</p>
                <div className="flex-1">
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-purple-cyan" 
                      style={{ width: `${stats.winRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Distribution Chart */}
        <div className="lg:col-span-1 glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Portfolio Distribution</h2>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={portfolioDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {portfolioDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(15, 6, 30, 0.95)',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: any) => formatNumber(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Trades List */}
        <div className="lg:col-span-2 glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Your Trades</h2>

          <Tabs defaultValue="OPEN" className="w-full" onValueChange={(value) => setFilter(value as any)}>
            <TabsList className="w-full md:w-auto mb-4">
              <TabsTrigger value="OPEN">
                Open Positions ({trades.filter(t => t.status === 'OPEN').length})
              </TabsTrigger>
              <TabsTrigger value="CLOSED">
                Closed ({trades.filter(t => t.status === 'CLOSED').length})
              </TabsTrigger>
              <TabsTrigger value="ALL">
                All ({trades.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filter}>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : filteredTrades.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No trades found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTrades.map((trade) => (
                    <div key={trade._id} className="bg-muted/20 rounded-lg p-4 border border-border/50 hover:border-primary/50 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-purple-cyan flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">{trade.tokenSymbol.slice(0, 2)}</span>
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold">{trade.tokenSymbol}</h3>
                              <Badge className={`${trade.action === 'BUY' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'} border text-xs`}>
                                {trade.action === 'BUY' ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                                {trade.action}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{trade.tokenName}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className={`font-semibold ${trade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.profitLoss >= 0 ? '+' : ''}{formatNumber(trade.profitLoss)}
                          </p>
                          <p className={`text-sm ${trade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.profitLossPercent >= 0 ? '+' : ''}{trade.profitLossPercent.toFixed(2)}%
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Entry Price</p>
                          <p className="text-sm font-semibold">${trade.entryPrice.toFixed(4)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Current Price</p>
                          <p className="text-sm font-semibold">${trade.currentPrice.toFixed(4)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Amount</p>
                          <p className="text-sm font-semibold">{trade.amount} {trade.tokenSymbol}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">USD Value</p>
                          <p className="text-sm font-semibold">{formatNumber(trade.usdValue)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border/30">
                        <p className="text-xs text-muted-foreground">
                          {new Date(trade.executedAt).toLocaleString()}
                        </p>
                        {trade.txSignature && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-auto py-1 px-2"
                            onClick={() => window.open(`https://solscan.io/tx/${trade.txSignature}`, '_blank')}
                          >
                            View TX
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
