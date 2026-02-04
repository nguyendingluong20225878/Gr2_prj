import fetch from "node-fetch";

export interface RegistryToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

const REGISTRY_URL =
  "https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json";

export async function fetchSolanaTokenRegistry(): Promise<RegistryToken[]> {
  const res = await fetch(REGISTRY_URL);
  if (!res.ok) throw new Error("Failed to fetch token registry");

  const json = await res.json();
  return json.tokens;
}
