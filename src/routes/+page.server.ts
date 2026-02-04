import { DEFAULT_AGENT_ID } from "$env/static/private"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ChatConfig } from "$lib/types/chat"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { PageServerLoad } from "./$types"

const chatConfigStore = getChatConfigStore()

const fallbackAgent: ChatConfig = {
	_id: "",
	name: "Mistral",
	description: "Mistral er en kraftig europeisk variant av ChatGPT",
	vendorId: "MISTRAL",
	project: "DEFAULT",
	model: "mistral-large-latest",
	instructions: "",
	accessGroups: "all",
	type: "published",
	created: {
		at: new Date().toISOString(),
		by: {
			id: "system"
		}
	},
	updated: {
		at: new Date().toISOString(),
		by: {
			id: "system"
		}
	}
}

const homePageLoad: ServerLoadNextFunction<{ agent: ChatConfig }> = async () => {
	if (!DEFAULT_AGENT_ID) {
		return { data: { agent: fallbackAgent }, isAuthorized: true }
	}
	const agent = await chatConfigStore.getChatConfig(DEFAULT_AGENT_ID)
	if (!agent) {
		return { data: { agent: fallbackAgent }, isAuthorized: true }
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
