import { error } from "@sveltejs/kit"
import { canUseCanvas } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { PageServerLoad } from "./$types"

const canvasPageLoad: ServerLoadNextFunction<Record<never, never>> = async ({ user }) => {
	return {
		data: {},
		isAuthorized: canUseCanvas(user, APP_CONFIG.APP_ROLES)
	}
}

export const load: PageServerLoad = async (requestEvent): Promise<Record<never, never>> => {
	if (!APP_CONFIG.CANVAS_ENABLED) {
		error(404, "Not Found")
	}
	return serverLoadRequestMiddleware(requestEvent, canvasPageLoad)
}
