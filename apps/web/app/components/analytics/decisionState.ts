import type { SignalAnalyticsRow } from '@/lib/types/analytics';

export type DecisionState = 'ready' | 'conflict' | 'risk' | 'wait';

export function getDecisionState(row: SignalAnalyticsRow): DecisionState {
  if (row.backtest?.outcome === 'LOSS') return 'conflict';
  if (Math.abs(row.signalScore) > 1.5 && row.confidence < 45) return 'conflict';
  if (row.semantics?.health.severity === 'HIGH' || row.semantics?.health.shouldDim) return 'risk';
  if (row.semantics?.volatility.severity === 'HIGH') return 'risk';
  if (row.semantics?.uncertainty?.severity === 'HIGH') return 'risk';
  if (row.action === 'HOLD') return 'wait';
  return 'ready';
}

export function decisionStateMeta(state: DecisionState) {
  if (state === 'ready') {
    return {
      label: 'Sẵn sàng đánh giá',
      className: 'border-green-500/30 bg-green-500/10 text-green-300',
    };
  }

  if (state === 'conflict') {
    return {
      label: 'Cần kiểm chứng lại',
      className: 'border-red-500/30 bg-red-500/10 text-red-300',
    };
  }

  if (state === 'risk') {
    return {
      label: 'Cần rà soát rủi ro',
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    };
  }

  return {
    label: 'Chờ thêm',
    className: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  };
}
