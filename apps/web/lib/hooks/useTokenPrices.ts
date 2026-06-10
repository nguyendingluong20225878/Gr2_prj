import { useEffect, useState, useRef } from 'react';
import { TokenPrice } from '../types';
import api from '../api';

export function useTokenPrices(tokenIds: string[] = [], intervalMs = 30000) {
  const [prices, setPrices] = useState<TokenPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    async function fetchPrices() {
      try {
        setLoading(true);
        const data = await api.getTokenPrices(tokenIds);
        if (!mounted.current) return;
        setPrices(data);
        setError(null);
      } catch (err) {
        if (!mounted.current) return;
        const message = err instanceof Error ? err.message : 'Failed to fetch token prices';
        setError(message);
      } finally {
        if (mounted.current) setLoading(false);
      }
    }

    fetchPrices();
    const timer = setInterval(fetchPrices, intervalMs);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [tokenIds.join(','), intervalMs]);

  return { prices, loading, error };
}
