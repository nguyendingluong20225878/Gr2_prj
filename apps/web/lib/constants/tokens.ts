export type TokenRegistryEntry = {
  symbol: string;
  name: string;
  address: string;
  aliases?: string[];
};

export const TOKEN_REGISTRY: TokenRegistryEntry[] = [
  {
    symbol: 'SOL',
    name: 'Wrapped SOL',
    address: 'So11111111111111111111111111111111111111112',
    aliases: ['So111'],
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    aliases: ['EPj'],
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCo3mYEPgY3E4hUYKfCe',
    aliases: ['Es9'],
  },
  {
    symbol: 'JUP',
    name: 'Jupiter',
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    aliases: ['JUP'],
  },
  {
    symbol: 'BONK',
    name: 'Bonk',
    address: 'DezXAZ8z7PnrnRJjz3B7Z5C5R5Z5oZ5Z5Z5Z5Z5Z5Z5',
    aliases: ['Dez'],
  },
];

export function findTokenByAddress(address: string | null | undefined) {
  if (!address) return null;

  return (
    TOKEN_REGISTRY.find((token) => token.address === address) ??
    TOKEN_REGISTRY.find((token) =>
      token.aliases?.some((alias) => address.startsWith(alias))
    ) ??
    null
  );
}

export function resolveTokenDisplay(address: string | null | undefined) {
  const token = findTokenByAddress(address);

  return {
    symbol: token?.symbol ?? 'TOKEN',
    name: token?.name ?? (address ? `${address.slice(0, 4)}...${address.slice(-4)}` : 'Unknown token'),
  };
}
