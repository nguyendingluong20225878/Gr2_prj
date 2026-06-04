import type { TokenSchema } from "../db/schema/tokens.js";
import type { ProposalInsert } from "../db/schema/proposal.js";

/**
 * Internal-only types
 */
type StaticTokenInsert = Omit<TokenSchema, "aliases"> & {
  aliases?: Array<{
    type: "mint" | "address" | "coingecko" | "priceKey" | "symbol" | "native";
    value: string;
  }>;
};

/* ===============================
   INITIAL TOKENS
================================ */

export const initialTokens: StaticTokenInsert[] = [
  {
    address: "So11111111111111111111111111111111111111112",
    aliases: [
      { type: "mint", value: "So11111111111111111111111111111111111111112" },
      { type: "symbol", value: "SOL" },
    ],
    canonicalKey: "solana:SOL",
    chain: "solana",
    symbol: "SOL",
    name: "Wrapped SOL",
    primaryAddress: "So11111111111111111111111111111111111111112",
    decimals: 9,
    type: "coin",
    iconUrl: "/tokens/SOL.png",
  },
  {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    aliases: [
      { type: "mint", value: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
      { type: "symbol", value: "USDC" },
    ],
    canonicalKey: "solana:USDC",
    chain: "solana",
    symbol: "USDC",
    name: "USD Coin",
    primaryAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    type: "coin",
    iconUrl: "/tokens/USDC.png",
  },
];

const STATIC_EXPIRATION_DATE = 1000 * 60 * 60 * 24;

/* ===============================
   STATIC PROPOSALS
================================ */

export const staticProposals =
  [
    {
      title: "Test Proposal: Reduce SOL Exposure",
      summary: "Test summary",
      reason: ["Reason 1", "Reason 2"],
      sources: [{ label: "Test Source", url: "#" }],
      type: "risk",
      proposedBy: "GR2 AI",
      expiresAt: new Date(Date.now() + STATIC_EXPIRATION_DATE),
      financialImpact: {
        currentValue: 100,
        projectedValue: 80,
        percentChange: -20,
        timeFrame: "immediate",
        riskLevel: "high",
      },
      status: "active",
    },
  ] as Omit<ProposalInsert, "userId">[];
