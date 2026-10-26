import { env } from "$env/dynamic/private"
import { getFallbackAgent } from "$lib/server/agents/fallback-agent"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ChatConfig } from "$lib/types/chat"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { PageServerLoad } from "./$types"

const chatConfigStore = getChatConfigStore()

const homePageLoad: ServerLoadNextFunction<{ agent: ChatConfig }> = async () => {
	if (!env.DEFAULT_AGENT_ID) {
		return { data: { agent: getFallbackAgent() }, isAuthorized: true }
	}
	const agent = await chatConfigStore.getChatConfig(env.DEFAULT_AGENT_ID)
	if (!agent) {
		return { data: { agent: getFallbackAgent() }, isAuthorized: true }
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
