'use client';

import { useState } from 'react';
import { useProposals } from '@/lib/hooks/useProposals';
import { ProposalCardSocial } from './ProposalCardSocial';
import { Sparkles, TrendingUp, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';

interface DashboardProps {
  onViewProposal?: (proposalId: string) => void;
}

export function Dashboard({ onViewProposal }: DashboardProps = {}) {
  const { proposals, loading, error } = useProposals();
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');

  const filteredProposals = proposals.filter(p => 
    filter === 'ALL' ? true : p.action === filter
  );

  const buyCount = proposals.filter(p => p.action === 'BUY').length;
  const sellCount = proposals.filter(p => p.action === 'SELL').length;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 rounded-xl text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Error Loading Proposals</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header - AI Command Center */}
      <div className="glass-card rounded-xl p-8 neon-border relative overflow-hidden">
        {/* Animated Scanner Effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyber-cyan/5 to-transparent animate-scan" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-3 bg-gradient-purple-cyan rounded-lg neon-glow">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold gradient-text">AI Command Center</h1>
              <p className="text-muted-foreground">Real-time market intelligence powered by NDL AI</p>
            </div>
          </div>

          {/* Terminal-style Live Status */}
          <div className="mt-4 flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-md">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 font-mono">SYSTEMS ONLINE</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-md">
              <span className="text-cyan-400 font-mono">X-SCRAPER ACTIVE</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-md">
              <span className="text-purple-400 font-mono">SIGNAL DETECTOR ON</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <p className="text-sm text-muted-foreground">Active Signals</p>
                </div>
                <p className="text-3xl font-bold gradient-text">{proposals.length}</p>
                <p className="text-xs text-slate-500 mt-1">Detected in last 24h</p>
              </div>
            </div>
            
            <div className="bg-slate-900/50 border border-green-500/30 rounded-lg p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <p className="text-sm text-green-400">Buy Opportunities</p>
                </div>
                <p className="text-3xl font-bold text-green-400">{buyCount}</p>
                <p className="text-xs text-slate-500 mt-1">High confidence entries</p>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-red-500/30 rounded-lg p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  <p className="text-sm text-red-400">Exit Signals</p>
                </div>
                <p className="text-3xl font-bold text-red-400">{sellCount}</p>
                <p className="text-xs text-slate-500 mt-1">Risk mitigation alerts</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Tabs defaultValue="ALL" className="w-full" onValueChange={(value) => setFilter(value as any)}>
        <TabsList className="glass-card w-full md:w-auto">
          <TabsTrigger value="ALL" className="flex-1 md:flex-none">
            All Signals ({proposals.length})
          </TabsTrigger>
          <TabsTrigger value="BUY" className="flex-1 md:flex-none">
            Buy ({buyCount})
          </TabsTrigger>
          <TabsTrigger value="SELL" className="flex-1 md:flex-none">
            Sell ({sellCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card rounded-xl p-6 space-y-4">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : filteredProposals.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Signals Found</h3>
              <p className="text-muted-foreground">
                {filter === 'ALL' 
                  ? 'No trading signals available at the moment.'
                  : `No ${filter.toLowerCase()} signals available.`
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProposals.map((proposal) => (
                <ProposalCardSocial 
                  key={proposal._id} 
                  proposal={proposal}
                  onViewDetails={onViewProposal}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}