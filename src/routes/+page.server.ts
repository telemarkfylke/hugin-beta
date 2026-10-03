import { env } from "$env/dynamic/private"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import { resolveConfig } from "$lib/server/models/model-registry"
import type { ChatConfig } from "$lib/types/chat"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { PageServerLoad } from "./$types"

const chatConfigStore = getChatConfigStore()

// vendorId/project here are placeholders - resolveConfig fills them (and model) from the default chat profile.
const defaultChatProfile = APP_CONFIG.MODEL_PROFILES.find((profile) => profile.id === APP_CONFIG.DEFAULT_PROFILE_IDS.CHAT)
const fallbackAgent: ChatConfig = resolveConfig<ChatConfig>({
	_id: "",
	name: defaultChatProfile?.label ?? APP_CONFIG.NAME,
	description: "Standard KI-assistent",
	vendorId: "MISTRAL",
	project: "DEFAULT",
	profile: APP_CONFIG.DEFAULT_PROFILE_IDS.CHAT,
	instructions: "",
	accessGroups: ["all"],
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
})

const homePageLoad: ServerLoadNextFunction<{ agent: ChatConfig }> = async () => {
	if (!env.DEFAULT_AGENT_ID) {
		return { data: { agent: fallbackAgent }, isAuthorized: true }
	}
	const agent = await chatConfigStore.getChatConfig(env.DEFAULT_AGENT_ID)
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
