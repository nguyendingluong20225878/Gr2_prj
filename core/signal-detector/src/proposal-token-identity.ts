export type ProposalTokenIdentityInput = {
  address?: string | null;
  canonicalKey?: string | null;
  chain?: string | null;
  _id?: { toString(): string } | string | null;
};

function clean(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized : null;
}

function isPlaceholderAddress(value: string | null): boolean {
  return value === null || ["native", "unknown"].includes(value.toLowerCase());
}

export function resolveProposalTokenIdentity(
  token: ProposalTokenIdentityInput | undefined,
  symbol: string
): string {
  const address = clean(token?.address);
  if (!isPlaceholderAddress(address)) return address as string;

  const canonicalKey = clean(token?.canonicalKey);
  if (canonicalKey) return canonicalKey;

  const chain = clean(token?.chain)?.toLowerCase();
  const normalizedSymbol = clean(symbol)?.toUpperCase() ?? "UNKNOWN";
  if (chain) return chain + ":" + normalizedSymbol;

  const id = token?._id ? String(token._id) : null;
  return id || "symbol:" + normalizedSymbol;
}
