import { logger } from "@vestfoldfylke/loglady"
import { FEATURE_KEYS, type FeatureFlag, type FeatureKey, NO_FEATURE_ROLES, resolveUserFeatures, type UserFeatures } from "$lib/featureflags/types"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getFeatureFlagStore } from "$lib/server/db/get-db"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"

// Checked on every page load and many API calls, so the matrix is cached in memory. An edit on
// /admin/features clears the cache on the instance that served it right away; other instances pick
// it up within CACHE_TTL_MS.
const CACHE_TTL_MS = 60_000

// Per-environment on/off switches, a different axis from roles: when the feature doesn't exist in
// this environment at all, nobody gets it - admins included.
export const ENVIRONMENT_DISABLED: Partial<Record<FeatureKey, string>> = APP_CONFIG.CANVAS_ENABLED ? {} : { canvas: "CANVAS_ENABLED er ikke satt i dette miljøet" }

let cache: { flags: FeatureFlag[]; fetchedAt: number } | null = null
let pendingLoad: Promise<FeatureFlag[]> | null = null

const loadFeatureFlags = async (): Promise<FeatureFlag[]> => {
	const store = getFeatureFlagStore()
	const flags = await store.getFeatureFlags()
	const missing = FEATURE_KEYS.filter((feature) => !flags.some((flag) => flag.feature === feature))
	if (missing.length === 0) {
		return flags
	}
	// A new feature in code shows up on /admin/features with nobody having access, until an admin decides
	logger.warn("Feature flags missing in DB, creating them with every role off: {features}", missing.join(", "))
	await store.insertMissingFeatures(missing)
	return [...flags, ...missing.map((feature) => ({ feature, roles: { ...NO_FEATURE_ROLES }, updatedAt: null, updatedBy: null }))]
}

export const getFeatureFlags = async (): Promise<FeatureFlag[]> => {
	if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
		return cache.flags
	}
	pendingLoad ??= loadFeatureFlags()
		.then((flags) => {
			cache = { flags, fetchedAt: Date.now() }
			return flags
		})
		.catch((error) => {
			logger.errorException(error, "Failed to load feature flags")
			// Keep serving the last known matrix (and retry after another TTL) rather than hammering a DB
			// that's down. With nothing loaded yet, fail closed: only admins keep their access.
			if (cache) {
				cache = { flags: cache.flags, fetchedAt: Date.now() }
				return cache.flags
			}
			return []
		})
		.finally(() => {
			pendingLoad = null
		})
	return pendingLoad
}

export const invalidateFeatureFlags = (): void => {
	cache = null
}

export const getUserFeatures = async (user: AuthenticatedPrincipal): Promise<UserFeatures> => {
	const features = resolveUserFeatures(user, await getFeatureFlags())
	for (const feature of Object.keys(ENVIRONMENT_DISABLED) as FeatureKey[]) {
		features[feature] = false
	}
	return features
}

export const hasFeature = async (user: AuthenticatedPrincipal, feature: FeatureKey): Promise<boolean> => {
	return (await getUserFeatures(user))[feature]
}
