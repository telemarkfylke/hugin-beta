import { json, type RequestHandler } from "@sveltejs/kit"
import { getFeatureMap } from "$lib/features/featuremap"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const getFeatures: ApiNextFunction = async () => {
	const featureMap = getFeatureMap()
	return { isAuthorized: true, response: json(featureMap) }
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, getFeatures)
}
