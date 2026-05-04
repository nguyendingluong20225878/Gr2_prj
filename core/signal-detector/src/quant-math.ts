export function calcNormEntropy(pPos: number, pNeg: number, pNeu: number): number {
  const p = [pPos, pNeg, pNeu].map(x => x <= 0 ? 1e-9 : x);
  const entropy = -(p[0] * Math.log(p[0]) + p[1] * Math.log(p[1]) + p[2] * Math.log(p[2]));
  return entropy / Math.log(3);
}

export function calcDecay(hoursOld: number, halfLife = 12): number {
  if (hoursOld < 0) return 1;
  return Math.exp(-(Math.LN2 / halfLife) * hoursOld);
}

export function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calcMAD(arr: number[]): number {
  if (arr.length === 0) return 0;
  const med = median(arr);
  const devs = arr.map(x => Math.abs(x - med));
  const mad = median(devs);
  return mad === 0 ? 1e-9 : mad; // Tránh chia cho 0
}

export function calcEMA(currentValue: number, previousEMA: number, periods = 7): number {
  const k = 2 / (periods + 1);
  return currentValue * k + previousEMA * (1 - k);
}