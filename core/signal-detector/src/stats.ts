// Các hàm thống kê cốt lõi

export function mean(values: number[]): number {
  if (!values.length) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

export function std(values: number[]): number {
  // Fix 1: Tránh chia cho 0 nếu mảng chỉ có 1 phần tử
  if (values.length < 2) return 0;
  const m = mean(values);
  let acc = 0;
  for (const v of values) {
    const d = v - m;
    acc += d * d;
  }
  // Dùng Population Std (chia cho N) thay vì Sample Std (N-1) cho data nhỏ
  return Math.sqrt(acc / values.length);
}

/**
 * Tính Z-Score có cơ chế chống khuếch đại nhiễu (Noise Amplification).
 * @param values Mảng giá trị gốc
 * @param minStd Mức sàn độ lệch chuẩn (Floor). Nếu std thực tế nhỏ hơn mức này, sẽ dùng mức này làm mẫu số.
 */
export function zscores(values: number[], minStd: number = 0.05): number[] {
  const m = mean(values);
  let s = std(values);

  // Trường hợp dữ liệu bằng nhau chằn chặn tuyệt đối -> Trả về 0 hết
  if (!Number.isFinite(s) || s < 1e-8) {
    return values.map(() => 0);
  }

  // Fix 2: Đặt sàn cho Standard Deviation. 
  // Chống hiện tượng s quá nhỏ làm vọt Z-score lên vô cực với những sai số cực nhỏ.
  s = Math.max(s, minStd);

  return values.map((v) => (v - m) / s);
}

export function weightedAvg(values: number[], weights: number[]): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < values.length; i++) {
    const w = Number.isFinite(weights[i]) ? Math.max(0, weights[i]) : 0;
    num += values[i] * w;
    den += w;
  }
  return den > 0 ? num / den : 0;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = Math.floor((sorted.length - 1) * q);
  return sorted[Math.max(0, Math.min(sorted.length - 1, pos))];
}