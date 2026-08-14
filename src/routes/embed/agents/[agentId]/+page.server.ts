import { loadAgentForPrompt } from "$lib/server/agents/load-agent-for-prompt"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ChatConfig } from "$lib/types/chat"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { PageServerLoad } from "./$types"

// Authenticated embed - same auth/authorization as /agents/[agentId], just rendered chrome-less
// (see +layout.server.ts isEmbedRoute). Intended for embedding internal agents on internal pages.
const embedAgentPageLoad: ServerLoadNextFunction<{ agent: ChatConfig }> = async ({ requestEvent, user }) => {
	const agent = await loadAgentForPrompt(user, requestEvent.params.agentId)
	return {
		data: {
			agent
		},
		isAuthorized: true
	}
}

export const load: PageServerLoad = async (requestEvent) => serverLoadRequestMiddleware(requestEvent, embedAgentPageLoad)
