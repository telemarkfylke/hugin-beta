import { getChatConfigStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ChatConfig } from "$lib/types/chat"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { PageServerLoad } from "./$types"

const chatConfigStore = getChatConfigStore()

const agentPageLoad: ServerLoadNextFunction<{ agent: ChatConfig }> = async ({ requestEvent, user }) => {
	const agentId = requestEvent.params.agentId
	if (!agentId) {
		throw new Error("agentId parameter is required")
	}
	const agent = await chatConfigStore.getChatConfig(agentId)
	if (!agent) {
		throw new HTTPError(404, `Agent with id ${agentId} not found`)
	}
	return {
		data: {
			agent
		},
		isAuthorized: true
	}
}

export const load: PageServerLoad = async (requestEvent): Promise<{ agent: ChatConfig }> => {
	return serverLoadRequestMiddleware(requestEvent, agentPageLoad)
}
