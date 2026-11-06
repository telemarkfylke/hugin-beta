import type { FeatureFlag, FeatureKey, FeatureRoleAccess } from "$lib/featureflags/types"

// Role -> feature access (see $lib/featureflags/types). Read through the cache in
// $lib/featureflags/server/feature-access, never directly - that's what keeps it off the hot path.
export interface IFeatureFlagStore {
	// Only features the code knows (FEATURE_KEYS) - unknown documents are ignored
	getFeatureFlags(): Promise<FeatureFlag[]>
	// Creates the given features with every role off. Never touches a feature that already exists.
	insertMissingFeatures(features: FeatureKey[]): Promise<void>
	setFeatureRoles(feature: FeatureKey, roles: FeatureRoleAccess, updatedBy: { id: string; name: string }): Promise<FeatureFlag>
}
