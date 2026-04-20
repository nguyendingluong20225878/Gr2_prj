//Các hàm thống kê
export function mean(values: number[]): number {
  if (!values.length) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

export function std(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let acc = 0;
  for (const v of values) {
    const d = v - m;
    acc += d * d;
  }
  return Math.sqrt(acc / values.length);
}

export function zscores(values: number[]): number[] {
  const m = mean(values);
  const s = std(values);
  if (!Number.isFinite(s) || s === 0) return values.map(() => 0);
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

