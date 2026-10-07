import { canManageMcpSources, canUseDatasources, canUseRagservice, canUseWebsiteDataSource } from "$lib/authorization"
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
	// Hides the Websites tab for non-admins - same pattern as canManageMcpSources.
	canUseWebsiteDataSource: boolean
}

// Base gate for the whole /datasources tab set (Dokumentsøk/MCP/Websites). The three tabs have
// different audiences - Dokumentsøk is EMPLOYEE-or-ADMIN (canUseRagservice), MCP and Websites are
// ADMIN-only (canManageMcpSources, canUseWebsiteDataSource). This layout gate rules out anyone with
// access to no tab at all (canUseDatasources) - each tab's own +page.server.ts still does the real,
// tab-specific, check.
const datasourcesLayoutLoad: ServerLoadNextFunction<DatasourcesLayoutData> = async ({ user }) => {
	return {
		data: {
			canUseRagservice: canUseRagservice(user, APP_CONFIG.APP_ROLES),
			canManageMcpSources: canManageMcpSources(user, APP_CONFIG.APP_ROLES),
			canUseWebsiteDataSource: canUseWebsiteDataSource(user, APP_CONFIG.APP_ROLES)
		},
		isAuthorized: canUseDatasources(user, APP_CONFIG.APP_ROLES)
	}
}

export const load: LayoutServerLoad = async (requestEvent): Promise<DatasourcesLayoutData> => {
	return serverLoadRequestMiddleware(requestEvent, datasourcesLayoutLoad)
}
