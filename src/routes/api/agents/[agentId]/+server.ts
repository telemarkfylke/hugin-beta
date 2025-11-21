import { json, type RequestHandler } from "@sveltejs/kit"
import { getDBAgent } from "$lib/server/agents/agents"
import type { DBAgent } from "$lib/types/agents"

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET: RequestHandler = async ({ params }) => {
	// Da spør vi DB om å hente assistenter som påkaller har tilgang på TODO - ferdig type og validering
	if (!params.agentId) {
		throw new Error("agentId is required")
	}
	console.log(`Fetching agent with ID ${params.agentId}`)
	const agent: DBAgent = await getDBAgent(params.agentId)
	if (!agent) {
		return json({ error: `Agent ${params.agentId} not found` }, { status: 404 })
	}
	// If agent has vector store or library, we want to include files as well
	// MOCK AI
	if (agent.config.type === "mock-agent") {
		if (agent.config.vectorStoreIds && agent.config.vectorStoreIds.length > 0) {
			// Fetch files from mock AI vector store
			// const files = await getFilesFromMockAIVectorStore(agent.config.vectorStoreIds)
			// agent.files = files
		}
	}

	return json({ agent })
}
