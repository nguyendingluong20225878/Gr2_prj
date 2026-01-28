// apps/web/hooks/useData.ts
import useSWR from 'swr';
import { Signal } from '@/models/Signal';
import { Proposal } from '@/models/Proposal';

// Hàm fetcher cơ bản
const fetcher = (url: string) => fetch(url).then(res => res.json());

// 1. Lấy danh sách tín hiệu thị trường cho Dashboard
export function useSignals(limit = 10) {
  const { data, error, isLoading } = useSWR<Signal[]>(`/api/signals?limit=${limit}`, fetcher);
  return { signals: data, error, isLoading };
}

// 2. Lấy thông tin cá nhân hóa của Proposal
export function useProposal(proposalId: string) {
  const { data, error, isLoading } = useSWR<Proposal>(
    proposalId ? `/api/proposals/${proposalId}` : null, 
    fetcher
  );
  return { proposal: data, error, isLoading };
}

// 3. Lấy bằng chứng thị trường gốc của Proposal đó (có cache)
export function useSignalDetail(signalId: string) {
  const { data, error, isLoading } = useSWR<Signal>(
    signalId ? `/api/signals/${signalId}` : null, 
    fetcher
  );
  return { signal: data, error, isLoading };
}