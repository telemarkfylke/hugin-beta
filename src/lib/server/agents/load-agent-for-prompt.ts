import { canPromptConfig } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig } from "$lib/types/chat"

const chatConfigStore = getChatConfigStore()

// Shared by /agents/[agentId] and the authenticated /embed/agents/[agentId] - same lookup +
// authorization, so it isn't maintained in two places.
export const loadAgentForPrompt = async (user: AuthenticatedPrincipal, agentId: string | undefined): Promise<ChatConfig> => {
	if (!agentId) {
		throw new Error("agentId parameter is required")
	}
	const agent = await chatConfigStore.getChatConfig(agentId)
	if (!agent) {
		throw new HTTPError(404, `Agent with id ${agentId} not found`)
	}
	if (!canPromptConfig(user, APP_CONFIG, agent)) {
		throw new HTTPError(403, "Du har ikke tilgang til denne assistenten")
	}
	return agent
}
