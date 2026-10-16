import { canUseTranscription } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { PageServerLoad } from "./$types"

// Same rule as the menu link (+layout.svelte) and every /api/transcription route.
const transcriptionPageLoad: ServerLoadNextFunction<Record<never, never>> = async ({ user }) => {
	return { data: {}, isAuthorized: canUseTranscription(user, APP_CONFIG.APP_ROLES) }
}

export const load: PageServerLoad = async (requestEvent): Promise<Record<never, never>> => {
	return serverLoadRequestMiddleware(requestEvent, transcriptionPageLoad)
}
