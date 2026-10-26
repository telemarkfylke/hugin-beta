import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { resolveConfig } from "$lib/server/models/model-registry"
import type { ChatConfig } from "$lib/types/chat"

// The home page's assistant when DEFAULT_AGENT_ID is unset or points nowhere - and what /api/chat
// answers with for `_id: ""`, so the two always agree without the client sending the config along.
// vendorId/project here are placeholders - resolveConfig fills them (and model) from the default chat profile.
const defaultChatProfile = APP_CONFIG.MODEL_PROFILES.find((profile) => profile.id === APP_CONFIG.DEFAULT_PROFILE_IDS.CHAT)
const FALLBACK_AGENT: ChatConfig = resolveConfig<ChatConfig>({
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

// A fresh copy each time - /api/chat mutates its config per request (RAG context, tools)
export const getFallbackAgent = (): ChatConfig => structuredClone(FALLBACK_AGENT)
