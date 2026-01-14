import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { AppConfig } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { LayoutServerLoad } from "./$types"

const layoutLoad: ServerLoadNextFunction<{ authenticatedUser: AuthenticatedPrincipal, APP_CONFIG: AppConfig }> = async ({ user }) => {
	return {
		data: {
			authenticatedUser: user,
			APP_CONFIG
		},
		isAuthorized: true
	}
}

export const load: LayoutServerLoad = async (requestEvent): Promise<{ authenticatedUser: AuthenticatedPrincipal, APP_CONFIG: AppConfig }> => {
	return serverLoadRequestMiddleware(requestEvent, layoutLoad)
}

