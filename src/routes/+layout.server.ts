import { ANONYMOUS_PRINCIPAL } from "$lib/anonymous-principal"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { AppConfig } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { LayoutServerLoad } from "./$types"

type LayoutData = { authenticatedUser: AuthenticatedPrincipal; APP_CONFIG: AppConfig; isEmbedRoute: boolean }

// isPublicRoute (auth): the ONLY exception to "every page requires EasyAuth" - currently just
// /public/embed/**. Written as a general /public/ prefix so future unauthenticated routes can
// land under the same prefix without touching this file again.
const isPublicRoute = (routeId: string | null): boolean => Boolean(routeId?.startsWith("/public/"))

// isEmbedRoute (rendering only): true for BOTH /embed/** (authenticated) and /public/embed/**
// (anonymous) - it only controls whether +layout.svelte hides the Menu/header chrome, and is
// completely independent of the auth decision above.
const isEmbedRoute = (routeId: string | null): boolean => Boolean(routeId?.includes("/embed/"))

const layoutLoad: ServerLoadNextFunction<LayoutData> = async ({ requestEvent, user }) => {
	return {
		data: {
			authenticatedUser: user,
			APP_CONFIG,
			isEmbedRoute: isEmbedRoute(requestEvent.route.id)
		},
		isAuthorized: true
	}
}

export const load: LayoutServerLoad = async (requestEvent): Promise<LayoutData> => {
	if (isPublicRoute(requestEvent.route.id)) {
		return { authenticatedUser: ANONYMOUS_PRINCIPAL, APP_CONFIG, isEmbedRoute: true }
	}
	return serverLoadRequestMiddleware(requestEvent, layoutLoad)
}
