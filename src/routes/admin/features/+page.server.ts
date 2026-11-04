import { canManageFeatureFlags } from "$lib/authorization"
import { ENVIRONMENT_DISABLED, getFeatureFlags, invalidateFeatureFlags } from "$lib/featureflags/server/feature-access"
import type { FeatureFlag, FeatureKey } from "$lib/featureflags/types"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { PageServerLoad } from "./$types"

type FeatureFlagsPageData = {
	flags: FeatureFlag[]
	environmentDisabled: Partial<Record<FeatureKey, string>>
}

const featureFlagsLoad: ServerLoadNextFunction<FeatureFlagsPageData> = async ({ user }) => {
	if (!canManageFeatureFlags(user, APP_CONFIG.APP_ROLES)) {
		return { data: { flags: [], environmentDisabled: {} }, isAuthorized: false }
	}
	// Always fresh from the DB here (another instance may have saved within the last TTL) - and this
	// instance's cache gets the fresh copy too
	invalidateFeatureFlags()
	return {
		data: { flags: await getFeatureFlags(), environmentDisabled: ENVIRONMENT_DISABLED },
		isAuthorized: true
	}
}

export const load: PageServerLoad = async (requestEvent): Promise<FeatureFlagsPageData> => {
	return serverLoadRequestMiddleware(requestEvent, featureFlagsLoad)
}
