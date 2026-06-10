import { useMemo } from 'react';
import { useSignals } from '@/lib/hooks/useSignals';
import { buildSignalAnalytics } from '@/lib/utils/signalAnalytics';

export function useSignalAnalytics() {
  const { demoReason, error, isDemoMode, lastUpdatedAt, loading, refetch, signals } = useSignals();

  const analytics = useMemo(() => buildSignalAnalytics(signals), [signals]);

  return {
    ...analytics,
    demoReason,
    loading,
    error,
    isDemoMode,
    lastUpdatedAt,
    refetch,
  };
}
