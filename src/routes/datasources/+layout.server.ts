import { canManageMcpSources, canManageWebsiteSources, canUseRagservice } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { LayoutServerLoad } from "./$types"

type DatasourcesLayoutData = {
	// Handed down to the bare /datasources index route so it can pick a default tab without
	// re-deriving the principal itself - see that route's +page.server.ts.
	canUseRagservice: boolean
	// Hides the MCP tab for non-admins - the tab's own +page.server.ts enforces the same check.
	canManageMcpSources: boolean
	// Hides the Websites tab for non-admins - same as canManageMcpSources above.
	canManageWebsiteSources: boolean
}

// Base gate for the whole /datasources tab set (Dokumentsøk/MCP/Websites). The three tabs don't
// share one audience - Dokumentsøk is EMPLOYEE-or-ADMIN (canUseRagservice), MCP and Websites are
// ADMIN-only (canManageMcpSources/canManageWebsiteSources) - so this only rules out someone with
// access to no tab at all (students, edu_employee-only). Each tab's own +page.server.ts still does
// the real, tab-specific, check.
const datasourcesLayoutLoad: ServerLoadNextFunction<DatasourcesLayoutData> = async ({ user }) => {
	const data = {
		canUseRagservice: canUseRagservice(user, APP_CONFIG.APP_ROLES),
		canManageMcpSources: canManageMcpSources(user, APP_CONFIG.APP_ROLES),
		canManageWebsiteSources: canManageWebsiteSources(user, APP_CONFIG.APP_ROLES)
	}
	return {
		data,
		isAuthorized: data.canUseRagservice || data.canManageMcpSources || data.canManageWebsiteSources
	}
}

export const load: LayoutServerLoad = async (requestEvent): Promise<DatasourcesLayoutData> => {
	return serverLoadRequestMiddleware(requestEvent, datasourcesLayoutLoad)
}
