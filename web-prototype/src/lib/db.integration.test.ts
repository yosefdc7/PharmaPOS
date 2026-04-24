import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getFeatureFlags, resetPrototypeData, setFeatureFlags } from "./db";

describe("db feature-flag migration", () => {
  beforeEach(async () => {
    await resetPrototypeData();
  });

  it("seeds a backward-compatible flag record", async () => {
    const flags = await getFeatureFlags();
    expect(flags).toEqual({ sync: false, payments: false, refunds: false });
  });

  it("supports staged rollout by enabling one surface at a time", async () => {
    await setFeatureFlags({ sync: true });
    expect(await getFeatureFlags()).toEqual({ sync: true, payments: false, refunds: false });
  });
});
