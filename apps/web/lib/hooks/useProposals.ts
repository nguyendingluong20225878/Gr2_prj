import { useCallback, useEffect, useState } from 'react';
import { ProposalUI } from '@/lib/types';
import { demoScenario } from '@/lib/demo/mockScenario';

export function useProposals() {
  const forceDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const [proposals, setProposals] = useState<ProposalUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const fetchProposals = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      setError(null);

      if (forceDemoMode) {
        setProposals(demoScenario.proposals);
        setIsDemoMode(true);
        setLastUpdatedAt(new Date().toISOString());
        return;
      }

      const res = await fetch('/api/proposals');
      
      if (!res.ok) {
        throw new Error('Failed to fetch signals from DB');
      }

      const data = (await res.json()) as ProposalUI[];
      setProposals(Array.isArray(data) ? data : []);
      setIsDemoMode(false);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      console.error("Fetch proposals error:", err);
      const message = err instanceof Error ? err.message : 'Failed to fetch proposals';
      setProposals([]);
      setError(message);
      setIsDemoMode(false);
      setLastUpdatedAt(new Date().toISOString());
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [forceDemoMode]);

  useEffect(() => {
    void fetchProposals();
    const interval = window.setInterval(() => void fetchProposals({ silent: true }), 30000);
    return () => window.clearInterval(interval);
  }, [fetchProposals]);

  return { error, isDemoMode, lastUpdatedAt, loading, proposals, refetch: fetchProposals };
}
