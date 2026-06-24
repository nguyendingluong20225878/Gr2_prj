/// <reference types="vitest" />
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const chain = (value: unknown) => {
    const query: any = {
      sort: vi.fn(() => query),
      lean: vi.fn().mockResolvedValue(value),
    };
    return query;
  };

  return {
    chain,
    newsArticlesTable: { findOne: vi.fn() },
    tweetTable: { findOne: vi.fn() },
    signalsTable: {
      findOneAndUpdate: vi.fn(),
      updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
      exists: vi.fn().mockResolvedValue(true),
    },
    proposalsTable: {
      findOne: vi.fn(),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 0, modifiedCount: 0, upsertedId: "new-proposal" }),
      updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
    },
    layer3Graph: {
      invoke: vi.fn().mockResolvedValue({ rationaleSummary: "AI rationale" }),
    },
  };
});

vi.mock("../../shared/src/index.js", () => ({
  newsArticlesTable: mocks.newsArticlesTable,
  signalsTable: mocks.signalsTable,
  tweetTable: mocks.tweetTable,
}));

vi.mock("../../shared/src/db/schema/proposal.js", () => ({
  proposalsTable: mocks.proposalsTable,
}));

vi.mock("../src/agent.js", () => ({
  layer3Graph: mocks.layer3Graph,
}));

function rawSignal(overrides: Record<string, unknown> = {}) {
  const batchStartedAt = new Date("2026-06-17T10:00:00.000Z");
  return {
    _id: { toString: () => "signal-1" },
    tokenSymbol: "TEST",
    tokenAddress: "test-address",
    quantScore: 1.2,
    confidence: 0.7,
    batchId: "batch-current",
    batchStartedAt,
    detectedAt: batchStartedAt,
    suggestionType: "buy",
    sentimentType: "positive",
    sources: [],
    layer3LockedBy: "worker-1",
    ...overrides,
  };
}

function activeProposal(overrides: Record<string, unknown> = {}) {
  return {
    _id: "proposal-1",
    tokenSymbol: "TEST",
    tokenAddress: "test-address",
    quantScore: 2,
    batchId: "batch-current",
    batchStartedAt: new Date("2026-06-17T10:00:00.000Z"),
    lifecycleStatus: "ACTIVE",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    createdAt: new Date("2026-06-17T10:00:00.000Z"),
    ...overrides,
  };
}

describe("Layer3 workflow proposal lifecycle", () => {
  beforeEach(() => {
    // Use fake timers to ensure tests don't fail when run after 2026-06-17 + TTL
    vi.useFakeTimers({ now: new Date("2026-06-17T10:00:00.000Z") });

    mocks.signalsTable.findOneAndUpdate.mockReset();
    mocks.signalsTable.updateOne.mockReset();
    mocks.signalsTable.updateMany.mockReset();
    mocks.signalsTable.exists.mockReset();
    mocks.proposalsTable.findOne.mockReset();
    mocks.proposalsTable.updateOne.mockReset();
    mocks.proposalsTable.updateMany.mockReset();
    mocks.layer3Graph.invoke.mockReset();
    mocks.signalsTable.findOneAndUpdate.mockReturnValue(mocks.chain(null));
    mocks.signalsTable.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.signalsTable.updateMany.mockResolvedValue({ modifiedCount: 0 });
    mocks.signalsTable.exists.mockResolvedValue(true);
    mocks.proposalsTable.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0, upsertedId: "new-proposal" });
    mocks.proposalsTable.updateMany.mockResolvedValue({ modifiedCount: 0 });
    mocks.layer3Graph.invoke.mockResolvedValue({ rationaleSummary: "AI rationale" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a new active proposal when only expired historical proposals exist", async () => {
    const { processSignal } = await import("../src/workflow.js");
    mocks.proposalsTable.findOne.mockReturnValueOnce(mocks.chain(null));

    const result = await processSignal(rawSignal(), { delayMs: 0 });

    expect(result.status).toBe("PROCESSED");
    expect(mocks.layer3Graph.invoke).toHaveBeenCalledOnce();
    expect(mocks.proposalsTable.updateOne).toHaveBeenCalledWith(
      { signalId: expect.anything() },
      expect.objectContaining({
        $set: expect.objectContaining({ lifecycleStatus: "ACTIVE" }),
      }),
      { upsert: true }
    );
  });

  it("ignores a same-batch active proposal when the new signal is weaker", async () => {
    const { processSignal } = await import("../src/workflow.js");
    mocks.proposalsTable.findOne.mockReturnValueOnce(mocks.chain(activeProposal({ quantScore: 3 })));

    const result = await processSignal(rawSignal({ quantScore: 1 }), { delayMs: 0 });

    expect(result.status).toBe("IGNORED_SAME_BATCH");
    expect(mocks.layer3Graph.invoke).not.toHaveBeenCalled();
    expect(mocks.signalsTable.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ layer3Decision: "IGNORED_WEAKER_SAME_BATCH" }),
      })
    );
  });

  it("replaces a same-batch active proposal when the new signal is stronger", async () => {
    const { processSignal } = await import("../src/workflow.js");
    mocks.proposalsTable.findOne.mockReturnValueOnce(mocks.chain(activeProposal({ quantScore: 0.5 })));

    const result = await processSignal(rawSignal({ quantScore: 2 }), { delayMs: 0 });

    expect(result.status).toBe("REPLACED_SAME_BATCH");
    expect(mocks.layer3Graph.invoke).toHaveBeenCalledOnce();
    expect(mocks.proposalsTable.updateOne).toHaveBeenCalledWith(
      { _id: "proposal-1" },
      expect.objectContaining({
        $set: expect.objectContaining({ lifecycleStatus: "ACTIVE" }),
      }),
      { upsert: true }
    );
  });

  it("overrides an older active proposal when the new signal is from a newer batch", async () => {
    const { processSignal } = await import("../src/workflow.js");
    mocks.proposalsTable.findOne
      .mockReturnValueOnce(mocks.chain(activeProposal({
        batchId: "batch-old",
        batchStartedAt: new Date("2026-06-17T09:00:00.000Z"),
      })))
      .mockReturnValueOnce(mocks.chain({ _id: "proposal-2" }));

    const result = await processSignal(rawSignal({ quantScore: 2 }), { delayMs: 0 });

    expect(result.status).toBe("OVERRIDDEN_PREVIOUS_BATCH");
    expect(mocks.proposalsTable.updateOne).toHaveBeenCalledWith(
      { _id: "proposal-1", lifecycleStatus: "ACTIVE" },
      expect.objectContaining({
        $set: expect.objectContaining({ lifecycleStatus: "OVERRIDDEN" }),
      })
    );
    expect(mocks.proposalsTable.updateOne).toHaveBeenCalledWith(
      { _id: "proposal-1" },
      expect.objectContaining({
        $set: expect.objectContaining({
          lifecycleStatus: "OVERRIDDEN",
          overriddenByProposalId: "proposal-2",
        }),
      })
    );
  });

  it("backs off retryable provider errors without failing the signal immediately", async () => {
    const { runLayer3Batch } = await import("../src/workflow.js");
    const providerError = Object.assign(new Error("Google API Error: 503 - overloaded"), {
      provider: "google",
      retryable: true,
      statusCode: 503,
      model: "gemini-2.5-flash",
    });
    mocks.signalsTable.findOneAndUpdate
      .mockReturnValueOnce(mocks.chain(rawSignal({ layer3RetryCount: 0 })))
      .mockReturnValueOnce(mocks.chain(null));
    mocks.proposalsTable.findOne.mockReturnValueOnce(mocks.chain(null));
    mocks.layer3Graph.invoke.mockRejectedValueOnce(providerError);

    const before = Date.now();
    const result = await runLayer3Batch({ limit: 1, delayMs: 0, maxRetry: 3 });

    expect(result.results[0]).toEqual(expect.objectContaining({
      status: "RETRYABLE_FAILED",
      tokenSymbol: "TEST",
      retryCount: 1,
      nextLayer3RetryAt: expect.any(Date),
    }));
    const retryAt = (result.results[0] as any).nextLayer3RetryAt as Date;
    expect(retryAt.getTime()).toBeGreaterThan(before);
    expect(mocks.signalsTable.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "RAW",
          lastLayer3ErrorCode: 503,
          nextLayer3RetryAt: expect.any(Date),
          layer3LockedAt: null,
          layer3LockedBy: null,
          errorType: "LAYER3_PROVIDER_RETRYABLE",
        }),
        $inc: { layer3RetryCount: 1 },
      })
    );
  });

  it("claim filter skips signals whose next retry time is in the future", async () => {
    const { runLayer3Batch } = await import("../src/workflow.js");
    mocks.signalsTable.findOneAndUpdate.mockReturnValueOnce(mocks.chain(null));

    await runLayer3Batch({ limit: 1, delayMs: 0, maxRetry: 3 });

    expect(mocks.signalsTable.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: expect.arrayContaining([
          expect.objectContaining({
            $or: expect.arrayContaining([
              { nextLayer3RetryAt: { $exists: false } },
              { nextLayer3RetryAt: null },
              expect.objectContaining({ nextLayer3RetryAt: expect.objectContaining({ $lte: expect.any(Date) }) }),
            ]),
          }),
        ]),
      }),
      expect.anything(),
      expect.anything()
    );
  });

  it("fails non-retryable provider errors immediately", async () => {
    const { runLayer3Batch } = await import("../src/workflow.js");
    const providerError = Object.assign(new Error("Google API Error: 401 - invalid key"), {
      provider: "google",
      retryable: false,
      statusCode: 401,
      model: "gemini-2.5-flash",
    });
    mocks.signalsTable.findOneAndUpdate
      .mockReturnValueOnce(mocks.chain(rawSignal({ layer3RetryCount: 0 })))
      .mockReturnValueOnce(mocks.chain(null));
    mocks.proposalsTable.findOne.mockReturnValueOnce(mocks.chain(null));
    mocks.layer3Graph.invoke.mockRejectedValueOnce(providerError);

    const result = await runLayer3Batch({ limit: 1, delayMs: 0, maxRetry: 3 });

    expect(result.results[0]).toEqual(expect.objectContaining({
      status: "FAILED",
      tokenSymbol: "TEST",
      retryCount: 1,
    }));
    expect(mocks.signalsTable.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "FAILED",
          lastLayer3ErrorCode: 401,
          nextLayer3RetryAt: null,
          errorType: "LAYER3_NON_RETRYABLE_ERROR",
        }),
        $inc: { layer3RetryCount: 1 },
      })
    );
  });
});
