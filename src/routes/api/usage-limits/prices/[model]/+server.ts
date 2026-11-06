import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { canManageUsageLimits } from "$lib/authorization"
import { getUsageLimitsStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { MODEL_CONFIG } from "$lib/server/models/models.config"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { getUsageLimitsSnapshot, invalidateUsageLimits } from "$lib/usagebudget/server/usage-limits"
import { ModelPriceSchema } from "$lib/usagebudget/types"

// Only catalogue models can be priced - a price under any other key would never be looked up
const knownModel = (model: string | undefined): string => {
	if (!model || !Object.hasOwn(MODEL_CONFIG.MODELS, model)) {
		throw new HTTPError(404, "Unknown model")
	}
	return model
}

const setModelPrice: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!canManageUsageLimits(user)) {
		throw new HTTPError(403, "Not authorized to manage model prices")
	}
	const model = knownModel(requestEvent.params.model)
	const input = ModelPriceSchema.safeParse(await requestEvent.request.json().catch(() => null))
	if (!input.success) {
		throw new HTTPError(400, "Body must be { inputPerMillion, outputPerMillion } in USD, 0-1000")
	}

	await getUsageLimitsStore().setModelPrice(model, input.data, { id: user.userId, name: user.name })
	invalidateUsageLimits()
	logger.info("Price for {model} set to {price} by {userId}", model, JSON.stringify(input.data), user.userId)

	const entry = (await getUsageLimitsSnapshot()).prices.find((price) => price.model === model)
	return { isAuthorized: true, response: json(entry ?? null) }
}

// Back to "no price" - the model is then counted as UNKNOWN_MODEL_PRICE
const deleteModelPrice: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!canManageUsageLimits(user)) {
		throw new HTTPError(403, "Not authorized to manage model prices")
	}
	const model = knownModel(requestEvent.params.model)

	await getUsageLimitsStore().deleteModelPrice(model)
	invalidateUsageLimits()
	logger.info("Price for {model} removed by {userId}", model, user.userId)

	return { isAuthorized: true, response: new Response(null, { status: 204 }) }
}

export const PUT: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, setModelPrice)
}

export const DELETE: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, deleteModelPrice)
}
