const rtf = new Intl.RelativeTimeFormat('vi-VN', { numeric: 'auto' });

type Unit = 'second' | 'minute' | 'hour' | 'day';

function pickUnit(milliseconds: number): { value: number; unit: Unit } {
  const abs = Math.abs(milliseconds);
  if (abs < 60_000) return { value: Math.round(milliseconds / 1000), unit: 'second' };
  if (abs < 3_600_000) return { value: Math.round(milliseconds / 60_000), unit: 'minute' };
  if (abs < 86_400_000) return { value: Math.round(milliseconds / 3_600_000), unit: 'hour' };
  return { value: Math.round(milliseconds / 86_400_000), unit: 'day' };
}

export function formatVietnameseDateTime(value?: string | Date | null) {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Chưa có dữ liệu';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeVietnamese(value?: string | Date | null, now = Date.now()) {
  if (!value) return 'Chưa có dữ liệu';
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return 'Chưa có dữ liệu';
  const diff = target - now;
  const { value: amount, unit } = pickUnit(diff);
  return rtf.format(amount, unit);
}

export function formatExpiry(input?: string | Date | null, now = Date.now()) {
  if (!input) return 'Chưa có dữ liệu';
  const target = new Date(input).getTime();
  if (!Number.isFinite(target)) return 'Chưa có dữ liệu';
  if (target <= now) return 'Đã hết hạn';
  const diff = target - now;
  const { value: amount, unit } = pickUnit(diff);
  const positive = Math.max(1, amount);
  const label = unit === 'day' ? 'ngày' : unit === 'hour' ? 'giờ' : unit === 'minute' ? 'phút' : 'giây';
  return `Còn ${positive} ${label}`;
}

export function isExpiringSoon(value?: string | Date | null, windowMs = 24 * 60 * 60 * 1000) {
  if (!value) return false;
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return false;
  const diff = target - Date.now();
  return diff > 0 && diff <= windowMs;
}

export function isExpired(value?: string | Date | null) {
  if (!value) return false;
  const target = new Date(value).getTime();
  return Number.isFinite(target) && target <= Date.now();
}

export function getExpiryBasisLabel(value?: string | Date | null) {
  if (!value) return 'Chưa có hạn hiệu lực rõ ràng.';
  return 'Hạn hiệu lực lấy từ expiresAt của proposal; với dữ liệu cũ thiếu expiresAt, hệ thống suy ra từ thời điểm tạo proposal.';
}
