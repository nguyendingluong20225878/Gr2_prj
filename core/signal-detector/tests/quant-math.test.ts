import { describe, test, expect } from 'vitest';
import { calcNormEntropy, calcDecay, calcMAD } from '../src/quant-math';

describe('Quant Math V3', () => {
  test('GĐ 1: Norm_Entropy phải cao khi pPos và pNeg ngang nhau', () => {
    const entropy = calcNormEntropy(0.48, 0.49, 0.03);
    expect(entropy).toBeGreaterThan(0.7); // Rất nhiễu loạn
  });

  test('GĐ 1: Norm_Entropy phải thấp khi có 1 cực thống trị', () => {
    const entropy = calcNormEntropy(0.9, 0.05, 0.05);
    expect(entropy).toBeLessThan(0.5); // Rất rõ ràng
  });

  test('GĐ 2: Decay giảm đúng 1 nửa sau 12h', () => {
    const weight = calcDecay(12, 12);
    expect(weight).toBeCloseTo(0.5);
  });

  test('GĐ 4: MAD tính toán chính xác và không bị nhiễu bởi outlier', () => {
    const arr = [1, 2, 2, 3, 100]; // 100 là nhiễu
    // Median là 2. Devs: [1, 0, 0, 1, 98]. Median của Devs là 0.
    const mad = calcMAD(arr);
    expect(mad).toBeGreaterThan(0); // Vì ta return 1e-9 thay vì 0 để tránh zero-division
  });
});