export function formatCurrency(value?: number | null, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Chưa có dữ liệu';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: decimals,
  }).format(Number(value));
}

export function formatDollarAmount(value?: number | null, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Chưa có dữ liệu';
  return `${new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value))} $`;
}

export function formatNumber(value?: number | null, decimals = 4) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Chưa có dữ liệu';
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: decimals,
  }).format(Number(value));
}

export function formatPercent(value?: number | null, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Chưa có dữ liệu';
  return `${Number(value).toFixed(decimals)}%`;
}

export function normalizeConfidenceValue(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const numeric = Number(value);
  return Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
}

export function formatConfidence(value?: number | null, decimals = 0) {
  const normalized = normalizeConfidenceValue(value);
  if (normalized === null) return 'Chưa có dữ liệu';
  return `${normalized.toFixed(decimals)}%`;
}

export function normalizePercentValue(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const numeric = Number(value);
  return Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
}

export function fallbackText(value?: string | number | null, fallback = 'Chưa có dữ liệu') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

export function toDisplayAction(action?: string | null) {
  const upper = String(action ?? '').toUpperCase();
  if (upper === 'BUY' || upper === 'LONG') return 'Mua';
  if (upper === 'SELL' || upper === 'SHORT') return 'Bán';
  if (upper === 'HOLD') return 'Giữ';
  if (upper === 'WAIT') return 'Theo dõi';
  if (upper === 'CLOSE_POSITION') return 'Đóng vị thế';
  return 'Theo dõi';
}

export function toDisplaySentiment(sentiment?: string | null) {
  const value = String(sentiment ?? '').toLowerCase();
  if (value === 'positive') return 'Tích cực';
  if (value === 'negative') return 'Tiêu cực';
  if (value === 'neutral') return 'Trung lập';
  return 'Chưa rõ';
}

export function toDisplayRisk(risk?: string | null) {
  const value = String(risk ?? '').toUpperCase();
  if (value === 'LOW') return 'Thấp';
  if (value === 'MEDIUM') return 'Trung bình';
  if (value === 'HIGH') return 'Cao';
  return 'Chưa có dữ liệu';
}
