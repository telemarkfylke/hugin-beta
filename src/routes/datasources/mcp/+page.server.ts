import { canManageMcpSources } from "$lib/authorization"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { PageServerLoad } from "./$types"

const mcpDatasourcesPageLoad: ServerLoadNextFunction<Record<never, never>> = async ({ user }) => {
	return {
		data: {},
		isAuthorized: canManageMcpSources(user)
	}
}

export const load: PageServerLoad = async (requestEvent): Promise<Record<never, never>> => {
	return serverLoadRequestMiddleware(requestEvent, mcpDatasourcesPageLoad)
}
