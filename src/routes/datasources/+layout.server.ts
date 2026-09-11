import { canUseRagservice, canUseWebsiteDataSource } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { LayoutServerLoad } from "./$types"

type DatasourcesLayoutData = {
	// Handed down to the bare /datasources index route so it can pick a default tab without
	// re-deriving the principal itself - see that route's +page.server.ts.
	canUseRagservice: boolean
}

// Base gate for the whole /datasources tab set (Dokumentsøk/MCP/Websites). The three tabs no
// longer share one audience - Dokumentsøk/MCP stay EMPLOYEE-or-ADMIN (canUseRagservice/
// canUseMcpSharepoint) but Websites is open to every authenticated user, students included
// (canUseWebsiteDataSource). This layout gate can therefore only rule out someone with access to
// *no* tab at all, which today is nobody - each tab's own +page.server.ts still does the real,
// now tab-specific, check.
const datasourcesLayoutLoad: ServerLoadNextFunction<DatasourcesLayoutData> = async ({ user }) => {
	return {
		data: { canUseRagservice: canUseRagservice(user, APP_CONFIG.APP_ROLES) },
		isAuthorized: canUseWebsiteDataSource(user, APP_CONFIG.APP_ROLES)
	}
}

export const load: LayoutServerLoad = async (requestEvent): Promise<DatasourcesLayoutData> => {
	return serverLoadRequestMiddleware(requestEvent, datasourcesLayoutLoad)
}
