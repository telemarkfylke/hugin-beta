import { type FeatureFlag, type FeatureKey, type FeatureRoleAccess, NO_FEATURE_ROLES } from "$lib/featureflags/types"
import type { IFeatureFlagStore } from "./interface"

// Pre-seeded with the access Hugin had before feature flags moved to the DB, so MOCK_DB=true local
// dev behaves the same for non-admin mock users. Mock data only - the real collection is seeded by
// scripts/seed-feature-flags.mjs and from then on edited on /admin/features.
const mockFeatureFlags: FeatureFlag[] = [
	{ feature: "canvas", roles: { employee: true, edu_employee: true, student: true }, updatedAt: null, updatedBy: null },
	{ feature: "ragservice", roles: { employee: true, edu_employee: false, student: false }, updatedAt: null, updatedBy: null },
	{ feature: "mcpSharepoint", roles: { employee: true, edu_employee: false, student: false }, updatedAt: null, updatedBy: null },
	{ feature: "websiteSources", roles: { employee: true, edu_employee: true, student: true }, updatedAt: null, updatedBy: null },
	{ feature: "transcription", roles: { employee: true, edu_employee: true, student: false }, updatedAt: null, updatedBy: null },
	{ feature: "history", roles: { employee: true, edu_employee: true, student: true }, updatedAt: null, updatedBy: null }
]

export class MockFeatureFlagStore implements IFeatureFlagStore {
	async getFeatureFlags(): Promise<FeatureFlag[]> {
		return mockFeatureFlags.map((flag) => ({ ...flag, roles: { ...flag.roles } }))
	}

	async insertMissingFeatures(features: FeatureKey[]): Promise<void> {
		for (const feature of features) {
			if (mockFeatureFlags.some((flag) => flag.feature === feature)) continue
			mockFeatureFlags.push({ feature, roles: { ...NO_FEATURE_ROLES }, updatedAt: null, updatedBy: null })
		}
	}

	async setFeatureRoles(feature: FeatureKey, roles: FeatureRoleAccess, updatedBy: { id: string; name: string }): Promise<FeatureFlag> {
		const updated: FeatureFlag = { feature, roles: { ...roles }, updatedAt: new Date(), updatedBy }
		const index = mockFeatureFlags.findIndex((flag) => flag.feature === feature)
		if (index === -1) {
			mockFeatureFlags.push(updated)
		} else {
			mockFeatureFlags[index] = updated
		}
		return { ...updated, roles: { ...updated.roles } }
	}
}
