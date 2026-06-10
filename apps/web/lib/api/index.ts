import { Proposal, Signal, TokenPrice, TriggerProposalRequest } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function handleJsonResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getSignals(since?: string, limit?: number): Promise<Signal[]> {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  if (limit) params.set('limit', String(limit));
  const url = `${API_BASE}/api/signals${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, { method: 'GET' });
  return handleJsonResponse(res);
}

export async function getProposals(userId?: string): Promise<Proposal[]> {
  const url = `${API_BASE}/api/proposals${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`;
  const res = await fetch(url, { method: 'GET' });
  return handleJsonResponse(res);
}

export async function triggerProposal(body: TriggerProposalRequest): Promise<{ success: boolean; jobId?: string }>{
  const url = `${API_BASE}/api/proposals/trigger`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleJsonResponse(res);
}

export async function getTokenPrices(ids?: string[]): Promise<TokenPrice[]> {
  const url = `${API_BASE}/api/token-prices${ids && ids.length ? `?ids=${encodeURIComponent(ids.join(','))}` : ''}`;
  const res = await fetch(url, { method: 'GET' });
  return handleJsonResponse(res);
}

export default { getSignals, getProposals, triggerProposal, getTokenPrices };
