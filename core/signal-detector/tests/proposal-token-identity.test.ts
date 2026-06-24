import { describe, expect, test } from "vitest";
import { resolveProposalTokenIdentity } from "../src/proposal-token-identity";

describe("resolveProposalTokenIdentity", () => {
  test("keeps a real contract address", () => {
    expect(resolveProposalTokenIdentity({ address: "So11111111111111111111111111111111111111112" }, "SOL"))
      .toBe("So11111111111111111111111111111111111111112");
  });

  test("uses canonicalKey instead of the shared native placeholder", () => {
    expect(resolveProposalTokenIdentity({ address: "native", canonicalKey: "solana:BTC", chain: "solana" }, "BTC"))
      .toBe("solana:BTC");
    expect(resolveProposalTokenIdentity({ address: "native", canonicalKey: "solana:SOL", chain: "solana" }, "SOL"))
      .toBe("solana:SOL");
  });

  test("falls back to a chain-qualified symbol when canonicalKey is absent", () => {
    expect(resolveProposalTokenIdentity({ address: "native", chain: "ethereum" }, "ETH"))
      .toBe("ethereum:ETH");
  });
});
