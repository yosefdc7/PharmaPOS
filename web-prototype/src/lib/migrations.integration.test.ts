import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { getFeatureFlags, resetPrototypeData, setFeatureFlags } from "./db";

describe("staging rollback procedure", () => {
  it("can disable risky surfaces as rollback kill-switches", async () => {
    await resetPrototypeData();
    await setFeatureFlags({ sync: true, payments: true, refunds: true });
    await setFeatureFlags({ sync: false, payments: false, refunds: false });

    expect(await getFeatureFlags()).toEqual({
      sync: false,
      payments: false,
      refunds: false
    });
  });
});
