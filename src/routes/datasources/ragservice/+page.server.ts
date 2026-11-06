import { hasFeature } from "$lib/featureflags/server/feature-access"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { PageServerLoad } from "./$types"

const ragservicePageLoad: ServerLoadNextFunction<Record<never, never>> = async ({ user }) => {
	return {
		data: {},
		isAuthorized: await hasFeature(user, "ragservice")
	}
}

export const load: PageServerLoad = async (requestEvent): Promise<Record<never, never>> => {
	return serverLoadRequestMiddleware(requestEvent, ragservicePageLoad)
}
