import { canUseRagservice } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { LayoutServerLoad } from "./$types"

// Base gate for the whole /datasources tab set (Dokumentsøk/MCP/Websites) - same employee-or-admin
// check as before the tabs existed. Each tab's own +page.server.ts still does its own (currently
// identical) check too, so a future tab-specific permission split doesn't require touching this file.
const datasourcesLayoutLoad: ServerLoadNextFunction<Record<never, never>> = async ({ user }) => {
	return {
		data: {},
		isAuthorized: canUseRagservice(user, APP_CONFIG.APP_ROLES)
	}
}

export const load: LayoutServerLoad = async (requestEvent): Promise<Record<never, never>> => {
	return serverLoadRequestMiddleware(requestEvent, datasourcesLayoutLoad)
}
