import { canManageWebsiteSources } from "$lib/authorization"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { PageServerLoad } from "./$types"

const websiteDatasourcesPageLoad: ServerLoadNextFunction<Record<never, never>> = async ({ user }) => {
	return {
		data: {},
		isAuthorized: canManageWebsiteSources(user)
	}
}

export const load: PageServerLoad = async (requestEvent): Promise<Record<never, never>> => {
	return serverLoadRequestMiddleware(requestEvent, websiteDatasourcesPageLoad)
}
