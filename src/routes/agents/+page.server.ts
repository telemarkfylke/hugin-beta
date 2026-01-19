import { getChatConfigStore } from "$lib/server/db/get-db"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ChatConfig } from "$lib/types/chat"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { PageServerLoad } from "./$types"

const chatConfigStore = getChatConfigStore()

const agentsPageLoad: ServerLoadNextFunction<{ agents: ChatConfig[] }> = async ({ user }) => {
	const agents = await chatConfigStore.getChatConfigs(user)
	return {
		data: {
			agents
		},
		isAuthorized: true
	}
}

export const load: PageServerLoad = async (requestEvent): Promise<{ agents: ChatConfig[] }> => {
	return serverLoadRequestMiddleware(requestEvent, agentsPageLoad)
}
