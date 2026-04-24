import { describe, expect, it } from "vitest";
import { DEFAULT_FEATURE_FLAGS, mergeFeatureFlags } from "./feature-flags";

describe("feature flag defaults", () => {
  it("keeps risky surfaces disabled by default", () => {
    expect(DEFAULT_FEATURE_FLAGS).toEqual({
      sync: false,
      payments: false,
      refunds: false
    });
  });

  it("merges partial rollout values without dropping keys", () => {
    expect(mergeFeatureFlags({ sync: true })).toEqual({
      sync: true,
      payments: false,
      refunds: false
    });
  });
});
