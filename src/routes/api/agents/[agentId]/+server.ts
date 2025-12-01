import { json, type RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent } from "$lib/server/agents/agents"
import type { Agent, DBAgent } from "$lib/types/agents"

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
	const dbAgent: DBAgent = await getDBAgent(params.agentId)

	if (!dbAgent) {
		return json({ error: `Agent ${params.agentId} not found` }, { status: 404 })
	}
	// If agent has vector store or library, we want to include files as well - this should be implemented in each agent type (interface IAgent)
	// MOCK AI
	if (dbAgent.config.type === "mock-agent") {
		if (dbAgent.config.vectorStoreIds && dbAgent.config.vectorStoreIds.length > 0) {
			// Fetch files from mock AI vector store
			// const files = await getFilesFromMockAIVectorStore(dbAgent.config.vectorStoreIds)
			// agent.files = files
		}
	}

	const agent: Agent = createAgent(dbAgent).getAgentInfo()

	return json({ agent })
}
