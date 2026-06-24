/// <reference types="vitest" />
import { describe, expect, it, vi } from "vitest";
import { mockSignal, mockTokenPrices, mockTweets, mockUser, mockUserBalances } from "./mockdata";

// Mock the dataFetchNode directly
vi.mock("../src/utils/db", () => ({
  fetchUser: vi.fn().mockResolvedValue(mockUser),
  fetchSignal: vi.fn().mockResolvedValue(mockSignal),
  fetchTokenPrices: vi.fn().mockResolvedValue(mockTokenPrices),
  fetchTweets: vi.fn().mockResolvedValue(mockTweets),
  fetchUserBalances: vi.fn().mockResolvedValue(mockUserBalances),
}));

describe("generateProposal with mock Node", () => {
  // Updated description
  it("should generate a proposal string containing the rationale summary", async () => {
    // Import needs to happen *after* vi.mock is declared
    const { initProposalGeneratorGraph } = await import("../src/index");
    const { graph, config } = await initProposalGeneratorGraph("signal-test", "user-test");

    // Since dataFetchNode is mocked, the graph should execute quickly
    const result = await graph.invoke({}, config);

    console.log("%o", result);

    expect(result).toBeDefined();
    // Check that rationaleSummary is present in the state
    expect(result).toHaveProperty("rationaleSummary");
    expect(typeof result.rationaleSummary).toBe("string");
    expect(result.rationaleSummary!.length).toBeGreaterThan(0);
  }, 60000); // Timeout might be reducible now
});
