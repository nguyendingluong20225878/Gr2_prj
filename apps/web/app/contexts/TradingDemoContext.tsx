'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export type DemoOrderStatus = 'pending' | 'filled' | 'cancelled';
export type DemoPositionStatus = 'open' | 'closed';
export type DemoAlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type DemoAlertStatus = 'new' | 'acknowledged' | 'resolved';
export type DemoDecisionStatus = 'reviewed' | 'watching' | 'rejected' | 'executed' | 'closed';
export type DemoTradeAction = 'BUY' | 'SELL';

export interface DemoProposalExecutionInput {
  action: DemoTradeAction;
  confidence: number;
  currentPrice: number;
  maxLossUsd?: number;
  proposalId: string;
  quantScore?: number;
  riskLevel: DemoAlertSeverity;
  riskPerTradePct?: number;
  roi: number;
  sizeUsd: number;
  stopLossPct?: number;
  targetPrice: number;
  tokenSymbol: string;
}

export interface DemoOrder {
  action: DemoTradeAction;
  confidence: number;
  createdAt: string;
  duplicate?: boolean;
  filledAt?: string;
  id: string;
  proposalId: string;
  riskLevel: DemoAlertSeverity;
  sizeUsd: number;
  status: DemoOrderStatus;
  tokenSymbol: string;
}

export interface DemoPosition {
  _id: string;
  confidence: number;
  createdAt: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  executedPrice: number;
  executionId: string;
  leverage: number;
  markPrice: number;
  orderId: string;
  pnl: number;
  proposalId: string;
  quantScore?: number;
  riskLevel: DemoAlertSeverity;
  roi: number;
  size: number;
  slippagePct: number;
  status: DemoPositionStatus;
  symbol: string;
  txHash: string;
}

export interface DemoAuditLog {
  action: string;
  confidence?: number;
  createdAt: string;
  id: string;
  proposalId?: string;
  riskLevel?: DemoAlertSeverity;
  tokenSymbol?: string;
}

export interface DemoRiskAlert {
  createdAt: string;
  detail: string;
  id: string;
  positionId?: string;
  proposalId?: string;
  severity: DemoAlertSeverity;
  status: DemoAlertStatus;
  title: string;
  tokenSymbol: string;
}

export interface DemoProposalDecision {
  blockers?: Array<{ label: string; severity: 'warning' | 'danger' }>;
  createdAt: string;
  id: string;
  proposalId: string;
  reason?: string;
  snapshot?: {
    action?: string;
    confidence?: number;
    quantScore?: number;
    riskLevel?: string;
    roi?: number;
  };
  status: DemoDecisionStatus;
  tokenSymbol?: string;
}

interface TradingDemoState {
  alerts: DemoRiskAlert[];
  auditLogs: DemoAuditLog[];
  closePosition: (positionId: string) => void;
  executeProposal: (input: DemoProposalExecutionInput) => DemoOrder;
  acknowledgeAlert: (alertId: string) => void;
  orders: DemoOrder[];
  positions: DemoPosition[];
  proposalDecisions: DemoProposalDecision[];
  recordProposalDecision: (input: Omit<DemoProposalDecision, 'createdAt' | 'id'>) => DemoProposalDecision;
  resetDemoSession: () => void;
  resolveAlert: (alertId: string) => void;
  storageScope: string;
}

interface PersistedTradingDemoState {
  alerts: DemoRiskAlert[];
  auditLogs: DemoAuditLog[];
  orders: DemoOrder[];
  positions: DemoPosition[];
  proposalDecisions: DemoProposalDecision[];
}

const STORAGE_KEY_PREFIX = 'ndl.trading.demo.v1';

const TradingDemoContext = createContext<TradingDemoState | null>(null);

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyState(): PersistedTradingDemoState {
  return { alerts: [], auditLogs: [], orders: [], positions: [], proposalDecisions: [] };
}

function storageKey(scope: string): string {
  return `${STORAGE_KEY_PREFIX}:${scope}`;
}

function safeReadState(scope: string): PersistedTradingDemoState {
  if (typeof window === 'undefined') return emptyState();

  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<PersistedTradingDemoState>;
    return {
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      positions: Array.isArray(parsed.positions) ? parsed.positions : [],
      proposalDecisions: Array.isArray(parsed.proposalDecisions) ? parsed.proposalDecisions : [],
    };
  } catch {
    return emptyState();
  }
}

export function TradingDemoProvider({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet();
  const storageScope = publicKey?.toBase58() || 'guest';
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [positions, setPositions] = useState<DemoPosition[]>([]);
  const [auditLogs, setAuditLogs] = useState<DemoAuditLog[]>([]);
  const [alerts, setAlerts] = useState<DemoRiskAlert[]>([]);
  const [proposalDecisions, setProposalDecisions] = useState<DemoProposalDecision[]>([]);
  const [hydratedScope, setHydratedScope] = useState<string | null>(null);

  useEffect(() => {
    setHydratedScope(null);
    const stored = safeReadState(storageScope);
    setOrders(stored.orders);
    setPositions(stored.positions);
    setAuditLogs(stored.auditLogs);
    setAlerts(stored.alerts);
    setProposalDecisions(stored.proposalDecisions);
    setHydratedScope(storageScope);
  }, [storageScope]);

  useEffect(() => {
    if (hydratedScope !== storageScope) return;
    const payload: PersistedTradingDemoState = { alerts, auditLogs, orders, positions, proposalDecisions };
    window.localStorage.setItem(storageKey(storageScope), JSON.stringify(payload));
  }, [alerts, auditLogs, hydratedScope, orders, positions, proposalDecisions, storageScope]);

  const recordProposalDecision = useCallback((input: Omit<DemoProposalDecision, 'createdAt' | 'id'>) => {
    const now = new Date().toISOString();
    const decision: DemoProposalDecision = {
      ...input,
      createdAt: now,
      id: createId('decision'),
    };

    setProposalDecisions((current) => [
      decision,
      ...current.filter((item) => item.proposalId !== input.proposalId || item.status !== input.status),
    ]);
    setAuditLogs((current) => [{
      action: `DECISION_${input.status.toUpperCase()}`,
      confidence: input.snapshot?.confidence,
      createdAt: now,
      id: createId('audit'),
      proposalId: input.proposalId,
      riskLevel: input.snapshot?.riskLevel as DemoAlertSeverity | undefined,
      tokenSymbol: input.tokenSymbol,
    }, ...current]);

    return decision;
  }, []);

  const executeProposal = useCallback((input: DemoProposalExecutionInput) => {
    const existingOrder = orders.find((order) => order.proposalId === input.proposalId && order.status !== 'cancelled');
    const existingPosition = positions.find((position) => position.proposalId === input.proposalId && position.status === 'open');
    if (existingOrder || existingPosition) {
      return {
        ...(existingOrder || {
          action: input.action,
          confidence: input.confidence,
          createdAt: existingPosition?.createdAt || new Date().toISOString(),
          id: existingPosition?.orderId || createId('order'),
          proposalId: input.proposalId,
          riskLevel: input.riskLevel,
          sizeUsd: input.sizeUsd,
          status: 'filled' as const,
          tokenSymbol: input.tokenSymbol,
        }),
        duplicate: true,
      };
    }

    const now = new Date().toISOString();
    const order: DemoOrder = {
      action: input.action,
      confidence: input.confidence,
      createdAt: now,
      id: createId('order'),
      proposalId: input.proposalId,
      riskLevel: input.riskLevel,
      sizeUsd: input.sizeUsd,
      status: 'pending',
      tokenSymbol: input.tokenSymbol,
    };

    setOrders((current) => [order, ...current]);
    setProposalDecisions((current) => [{
      createdAt: now,
      id: createId('decision'),
      proposalId: input.proposalId,
      reason: 'Mock execution requested from proposal decision panel.',
      snapshot: {
        action: input.action,
        confidence: input.confidence,
        quantScore: input.quantScore,
        riskLevel: input.riskLevel,
        roi: input.roi,
      },
      status: 'reviewed',
      tokenSymbol: input.tokenSymbol,
    }, ...current.filter((item) => item.proposalId !== input.proposalId || item.status !== 'reviewed')]);
    setAuditLogs((current) => [{
      action: 'ENTER_REQUESTED',
      confidence: input.confidence,
      createdAt: now,
      id: createId('audit'),
      proposalId: input.proposalId,
      riskLevel: input.riskLevel,
      tokenSymbol: input.tokenSymbol,
    }, ...current]);

    window.setTimeout(() => {
      const filledAt = new Date().toISOString();
      const slippagePct = input.riskLevel === 'HIGH' ? 0.18 : input.riskLevel === 'MEDIUM' ? 0.08 : 0.03;
      const executedPrice = input.action === 'BUY'
        ? input.currentPrice * (1 + slippagePct / 100)
        : input.currentPrice * (1 - slippagePct / 100);
      const stressRoi = input.riskLevel === 'HIGH' ? Math.min(input.roi, -1.4) : input.roi;
      const pnl = input.sizeUsd * (stressRoi / 100);
      const position: DemoPosition = {
        _id: createId('pos'),
        confidence: input.confidence,
        createdAt: filledAt,
        direction: input.action === 'SELL' ? 'SHORT' : 'LONG',
        entryPrice: input.currentPrice,
        executedPrice,
        executionId: order.id,
        leverage: 1,
        markPrice: input.targetPrice || executedPrice,
        orderId: order.id,
        pnl,
        proposalId: input.proposalId,
        quantScore: input.quantScore,
        riskLevel: input.riskLevel,
        roi: stressRoi,
        size: input.sizeUsd,
        slippagePct,
        status: 'open',
        symbol: input.tokenSymbol,
        txHash: `demo:${order.id}`,
      };

      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, filledAt, status: 'filled' } : item));
      setPositions((current) => [position, ...current.filter((item) => item.proposalId !== input.proposalId || item.status !== 'open')]);
      setProposalDecisions((current) => [{
        createdAt: filledAt,
        id: createId('decision'),
        proposalId: input.proposalId,
        reason: 'Mock order filled and lifecycle moved to open position monitoring.',
        snapshot: {
          action: input.action,
          confidence: input.confidence,
          quantScore: input.quantScore,
          riskLevel: input.riskLevel,
          roi: stressRoi,
        },
        status: 'executed',
        tokenSymbol: input.tokenSymbol,
      }, ...current.filter((item) => item.proposalId !== input.proposalId || item.status !== 'executed')]);
      setAuditLogs((current) => [{
        action: 'FILLED_OPEN_POSITION',
        confidence: input.confidence,
        createdAt: filledAt,
        id: createId('audit'),
        proposalId: input.proposalId,
        riskLevel: input.riskLevel,
        tokenSymbol: input.tokenSymbol,
      }, ...current]);

      if (input.riskLevel === 'HIGH' || stressRoi < -1 || input.stopLossPct !== undefined) {
        setAlerts((current) => [{
          createdAt: filledAt,
          detail: `${input.tokenSymbol} demo position requires review. Risk ${input.riskLevel}, projected ROI ${stressRoi.toFixed(2)}%, max loss ${input.maxLossUsd ? `$${input.maxLossUsd.toFixed(2)}` : 'Chưa có dữ liệu'}.`,
          id: createId('alert'),
          positionId: position._id,
          proposalId: input.proposalId,
          severity: input.riskLevel === 'LOW' ? 'MEDIUM' : input.riskLevel,
          status: 'new',
          title: `${input.tokenSymbol}: position lifecycle risk interrupt`,
          tokenSymbol: input.tokenSymbol,
        }, ...current]);
      }
    }, 900);

    return order;
  }, [orders, positions]);

  const closePosition = useCallback((positionId: string) => {
    const now = new Date().toISOString();
    const targetPosition = positions.find((item) => item._id === positionId);
    setPositions((current) => current.map((position) => position._id === positionId ? { ...position, status: 'closed' } : position));
    if (targetPosition?.proposalId) {
      setProposalDecisions((current) => [{
        createdAt: now,
        id: createId('decision'),
        proposalId: targetPosition.proposalId,
        reason: 'Demo position was closed from the position risk manager.',
        snapshot: {
          action: targetPosition.direction,
          confidence: targetPosition.confidence,
          quantScore: targetPosition.quantScore,
          riskLevel: targetPosition.riskLevel,
          roi: targetPosition.roi,
        },
        status: 'closed',
        tokenSymbol: targetPosition.symbol,
      }, ...current.filter((item) => item.proposalId !== targetPosition.proposalId || item.status !== 'closed')]);
    }
    setAuditLogs((current) => [{
      action: 'CLOSED_POSITION',
      createdAt: now,
      id: createId('audit'),
      proposalId: targetPosition?.proposalId,
      riskLevel: targetPosition?.riskLevel,
      tokenSymbol: targetPosition?.symbol,
    }, ...current]);
    setAlerts((current) => current.map((alert) => alert.positionId === positionId ? { ...alert, status: 'resolved' } : alert));
  }, [positions]);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts((current) => current.map((alert) => alert.id === alertId ? { ...alert, status: 'acknowledged' } : alert));
  }, []);

  const resolveAlert = useCallback((alertId: string) => {
    setAlerts((current) => current.map((alert) => alert.id === alertId ? { ...alert, status: 'resolved' } : alert));
  }, []);

  const resetDemoSession = useCallback(() => {
    setOrders([]);
    setPositions([]);
    setAuditLogs([]);
    setAlerts([]);
    setProposalDecisions([]);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey(storageScope));
    }
  }, [storageScope]);

  const value = useMemo<TradingDemoState>(() => ({
    acknowledgeAlert,
    alerts,
    auditLogs,
    closePosition,
    executeProposal,
    orders,
    positions,
    proposalDecisions,
    recordProposalDecision,
    resetDemoSession,
    resolveAlert,
    storageScope,
  }), [acknowledgeAlert, alerts, auditLogs, closePosition, executeProposal, orders, positions, proposalDecisions, recordProposalDecision, resetDemoSession, resolveAlert, storageScope]);

  return <TradingDemoContext.Provider value={value}>{children}</TradingDemoContext.Provider>;
}

export function useTradingDemoStore(): TradingDemoState {
  const context = useContext(TradingDemoContext);
  if (!context) {
    throw new Error('useTradingDemoStore must be used inside TradingDemoProvider');
  }
  return context;
}
