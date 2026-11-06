import { error } from "@sveltejs/kit"
import { hasFeature } from "$lib/featureflags/server/feature-access"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { LayoutServerLoad } from "./$types"

const canvasLayoutLoad: ServerLoadNextFunction<Record<never, never>> = async ({ user }) => {
	return {
		data: {},
		isAuthorized: await hasFeature(user, "canvas")
	}
}

export const load: LayoutServerLoad = async (requestEvent): Promise<Record<never, never>> => {
	if (!APP_CONFIG.CANVAS_ENABLED) {
		error(404, "Not Found")
	}
	return serverLoadRequestMiddleware(requestEvent, canvasLayoutLoad)
}
