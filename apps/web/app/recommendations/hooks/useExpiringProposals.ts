'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ProposalData } from '@/lib/hooks/useNdlData';
import { isExpired, isExpiringSoon } from '@/lib/utils/time';

export function useExpiringProposals(proposals: ProposalData[], options?: { expiringWindowMs?: number }) {
  const expiringWindowMs = options?.expiringWindowMs ?? 30 * 60 * 1000;
  const [now, setNow] = useState(Date.now());
  const notifiedExpiredRef = useRef(new Set<string>());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    proposals.forEach((proposal) => {
      if (!proposal._id || !isExpired(proposal.expiresAt) || notifiedExpiredRef.current.has(proposal._id)) return;
      notifiedExpiredRef.current.add(proposal._id);
      toast.info(`${proposal.tokenSymbol ?? 'Khuyến nghị'} đã hết hạn và được ẩn khỏi danh sách.`);
    });
  }, [now, proposals]);

  return useMemo(() => {
    const activeProposals = proposals.filter((proposal) => !isExpired(proposal.expiresAt));
    const expiringProposalIds = new Set(
      activeProposals
        .filter((proposal) => isExpiringSoon(proposal.expiresAt, expiringWindowMs))
        .map((proposal) => proposal._id)
    );

    return { activeProposals, expiringProposalIds };
  }, [expiringWindowMs, now, proposals]);
}
