import { getChatConfigStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ChatConfig } from "$lib/types/chat"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { PageServerLoad } from "./$types"

const chatConfigStore = getChatConfigStore()

const DEFAULT_AGENT_ID = "1000" // Mistral agent

const homePageLoad: ServerLoadNextFunction<{ agent: ChatConfig }> = async () => {
	const agent = await chatConfigStore.getChatConfig(DEFAULT_AGENT_ID)
	if (!agent) {
		throw new HTTPError(404, `Default agent with id ${DEFAULT_AGENT_ID} not found`)
	}
	return {
		data: {
			agent
		},
		isAuthorized: true
	}
}

export const load: PageServerLoad = async (requestEvent): Promise<{ agent: ChatConfig }> => {
	return serverLoadRequestMiddleware(requestEvent, homePageLoad)
}
