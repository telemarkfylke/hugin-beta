import { canManageUsageLimits } from "$lib/authorization"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import { MODEL_CONFIG } from "$lib/server/models/models.config"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import { getUsageLimitsSnapshot, invalidateUsageLimits } from "$lib/usagebudget/server/usage-limits"
import type { ModelPriceEntry, UsageLimitsSettings } from "$lib/usagebudget/types"
import type { PageServerLoad } from "./$types"

export type CatalogueModelRow = {
	model: string
	vendor: string
	providerModel: string
	retired: boolean
	internal: boolean
}

type RateLimitsPageData = {
	settings: UsageLimitsSettings | null
	prices: ModelPriceEntry[]
	invalidPrices: string[]
	models: CatalogueModelRow[]
}

const rateLimitsLoad: ServerLoadNextFunction<RateLimitsPageData> = async ({ user }) => {
	if (!canManageUsageLimits(user)) {
		return { data: { settings: null, prices: [], invalidPrices: [], models: [] }, isAuthorized: false }
	}
	// Always fresh from the DB here (another instance may have saved within the last TTL) - and this
	// instance's cache gets the fresh copy too
	invalidateUsageLimits()
	const snapshot = await getUsageLimitsSnapshot()
	const models = Object.entries(MODEL_CONFIG.MODELS).map(([model, m]) => ({
		model,
		vendor: m.vendor,
		providerModel: m.providerModel,
		retired: m.status === "retired",
		internal: "internal" in m && m.internal === true
	}))
	return {
		data: { settings: snapshot.settings, prices: snapshot.prices, invalidPrices: snapshot.invalidPrices, models },
		isAuthorized: true
	}
}

export const load: PageServerLoad = async (requestEvent): Promise<RateLimitsPageData> => {
	return serverLoadRequestMiddleware(requestEvent, rateLimitsLoad)
}
