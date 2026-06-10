type RawUserProfileInput = {
  age?: unknown;
  cryptoInvestmentUsd?: unknown;
  email?: unknown;
  name?: unknown;
  notificationEnabled?: unknown;
  riskTolerance?: unknown;
  totalAssetUsd?: unknown;
  tradeStyle?: unknown;
};

type RawBalanceInput = {
  balance?: unknown;
  tokenAddress?: unknown;
  updatedAt?: unknown;
};

export type SanitizedUserProfile = {
  age?: number;
  cryptoInvestmentUsd?: number;
  email?: string;
  name?: string;
  notificationEnabled?: boolean;
  riskTolerance?: 'low' | 'medium' | 'high';
  totalAssetUsd?: number;
  tradeStyle?: 'scalp' | 'swing' | 'position';
};

export type SanitizedUserBalance = {
  balance: string;
  tokenAddress: string;
  updatedAt: Date;
};

const BASE58_WALLET_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RISK_TOLERANCES = new Set(['low', 'medium', 'high']);
const TRADE_STYLES = new Set(['scalp', 'swing', 'position']);

function optionalString(value: unknown, fieldName: string, maxLength: number) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${fieldName} must be a string`);

  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${fieldName} is too long`);
  return trimmed;
}

function optionalNonNegativeNumber(value: unknown, fieldName: string) {
  if (value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number`);
  }

  return parsed;
}

export function sanitizeWalletAddress(value: unknown) {
  if (typeof value !== 'string') throw new Error('walletAddress must be a string');
  const walletAddress = value.trim();

  if (!BASE58_WALLET_PATTERN.test(walletAddress)) {
    throw new Error('walletAddress is invalid');
  }

  return walletAddress;
}

export function sanitizeUserProfileInput(input: RawUserProfileInput): SanitizedUserProfile {
  const sanitized: SanitizedUserProfile = {};
  const name = optionalString(input.name, 'name', 80);
  const email = optionalString(input.email, 'email', 160);
  const riskTolerance = optionalString(input.riskTolerance, 'riskTolerance', 20);
  const tradeStyle = optionalString(input.tradeStyle, 'tradeStyle', 20);

  if (name !== undefined) sanitized.name = name;
  if (email !== undefined) {
    if (email && !EMAIL_PATTERN.test(email)) throw new Error('email is invalid');
    sanitized.email = email;
  }

  const age = optionalNonNegativeNumber(input.age, 'age');
  if (age !== undefined) {
    if (!Number.isInteger(age) || age > 120) throw new Error('age must be an integer from 0 to 120');
    sanitized.age = age;
  }

  if (riskTolerance !== undefined) {
    if (!RISK_TOLERANCES.has(riskTolerance)) throw new Error('riskTolerance is invalid');
    sanitized.riskTolerance = riskTolerance as SanitizedUserProfile['riskTolerance'];
  }

  if (tradeStyle !== undefined) {
    if (!TRADE_STYLES.has(tradeStyle)) throw new Error('tradeStyle is invalid');
    sanitized.tradeStyle = tradeStyle as SanitizedUserProfile['tradeStyle'];
  }

  const totalAssetUsd = optionalNonNegativeNumber(input.totalAssetUsd, 'totalAssetUsd');
  if (totalAssetUsd !== undefined) sanitized.totalAssetUsd = totalAssetUsd;

  const cryptoInvestmentUsd = optionalNonNegativeNumber(input.cryptoInvestmentUsd, 'cryptoInvestmentUsd');
  if (cryptoInvestmentUsd !== undefined) sanitized.cryptoInvestmentUsd = cryptoInvestmentUsd;

  if (input.notificationEnabled !== undefined) {
    if (typeof input.notificationEnabled !== 'boolean') {
      throw new Error('notificationEnabled must be a boolean');
    }
    sanitized.notificationEnabled = input.notificationEnabled;
  }

  return sanitized;
}

export function sanitizeBalancesInput(value: unknown): SanitizedUserBalance[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('balances must be an array');
  if (value.length > 200) throw new Error('balances is too large');

  return value.map((item, index) => {
    const balance = item as RawBalanceInput;
    const tokenAddress = optionalString(balance.tokenAddress, `balances[${index}].tokenAddress`, 80);
    const rawAmount = optionalString(balance.balance, `balances[${index}].balance`, 80);

    if (!tokenAddress) throw new Error(`balances[${index}].tokenAddress is required`);
    if (!rawAmount) throw new Error(`balances[${index}].balance is required`);

    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`balances[${index}].balance must be a non-negative number`);
    }

    const updatedAt = balance.updatedAt ? new Date(String(balance.updatedAt)) : new Date();
    if (!Number.isFinite(updatedAt.getTime())) {
      throw new Error(`balances[${index}].updatedAt is invalid`);
    }

    return {
      balance: rawAmount,
      tokenAddress,
      updatedAt,
    };
  });
}
