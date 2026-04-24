export type FeatureFlagKey = "sync" | "payments" | "refunds";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  sync: false,
  payments: false,
  refunds: false
};

export function mergeFeatureFlags(input?: Partial<FeatureFlags> | null): FeatureFlags {
  return {
    ...DEFAULT_FEATURE_FLAGS,
    ...(input || {})
  };
}
