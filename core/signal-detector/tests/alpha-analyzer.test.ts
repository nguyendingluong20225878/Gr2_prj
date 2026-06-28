import { describe, expect, test } from "vitest";
import { evaluateAlphaAndCross } from "../src/alpha-analyzer";
import { DEFAULT_HYPER_PARAMS, DetectorHyperParams, TokenQuantState } from "../src/types";

function buildState(unifiedRaw: number): Map<string, TokenQuantState> {
  return new Map([
    [
      "TEST",
      {
        symbol: "TEST",
        tokenAddress: "0xtest",
        docsCount: 1,
        unifiedRaw,
        avgEntropy: 0.2,
        sources: [{ url: "https://example.com", label: "example" }],
      },
    ],
  ]);
}

const params: DetectorHyperParams = {
  ...DEFAULT_HYPER_PARAMS,
  signalThreshold: 1.2,
  actionThreshold: 1.8,
  holdSignalThreshold: 1.8,
  coldStartActionThreshold: 1.8,
};

describe("evaluateAlphaAndCross signal thresholds", () => {
  test("drops weak hold signals", () => {
    const signals = evaluateAlphaAndCross(buildState(1.7), {}, params);
    expect(signals).toHaveLength(0);
  });

  test("uses inclusive action threshold for buy signals", () => {
    const signals = evaluateAlphaAndCross(buildState(1.8), {}, params);
    expect(signals).toHaveLength(1);
    expect(signals[0].suggestionType).toBe("buy");
    expect(signals[0].metadata?.thresholdDecision.requiredSignalThreshold).toBe(1.2);
  });

  test("keeps strong hold only when hold threshold is met before action threshold", () => {
    const holdParams = { ...params, actionThreshold: 2, coldStartActionThreshold: 2 };
    const signals = evaluateAlphaAndCross(buildState(1.8), {}, holdParams);
    expect(signals).toHaveLength(1);
    expect(signals[0].suggestionType).toBe("hold");
    expect(signals[0].metadata?.thresholdDecision.requiredSignalThreshold).toBe(1.8);
  });

  test("keeps sell signals at the inclusive negative action threshold", () => {
    const signals = evaluateAlphaAndCross(buildState(-1.8), {}, params);
    expect(signals).toHaveLength(1);
    expect(signals[0].suggestionType).toBe("sell");
  });

  test("clamps extreme scores while preserving the raw score in metadata", () => {
    const signals = evaluateAlphaAndCross(buildState(47), {}, params);
    expect(signals).toHaveLength(1);
    expect(signals[0].quantScore).toBe(5);
    expect(signals[0].metadata?.scoreComponents.rawFinalScore).toBe(47);
    expect(signals[0].metadata?.scoreComponents.scoreWasClamped).toBe(true);
  });
});
