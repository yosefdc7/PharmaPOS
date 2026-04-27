import { describe, expect, it } from "vitest";
import { DEFAULT_FEATURE_FLAGS, mergeFeatureFlags } from "./feature-flags";

describe("feature flag defaults", () => {
  it("keeps risky surfaces enabled by default for prototype", () => {
    expect(DEFAULT_FEATURE_FLAGS).toEqual({
      sync: true,
      payments: true,
      refunds: true
    });
  });

  it("merges partial rollout values without dropping keys", () => {
    expect(mergeFeatureFlags({ sync: false })).toEqual({
      sync: false,
      payments: true,
      refunds: true
    });
  });
});
