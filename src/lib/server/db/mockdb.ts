import type { Conversation, DBAgent } from "$lib/types/agents.js"

export const getMockDb = async (): Promise<{ agents: DBAgent[]; conversations: Conversation[] }> => {
	// We add the mock agent here so it is always present in the mock db
	const mockAgent: DBAgent = {
		_id: "mock-agent",
		name: "Mock AI Agent",
		description: "Mock AI agent, which responds with streaming mock data (no real AI or cost)",
		config: {
			type: "mock-agent",
			instructions: "You are a mock AI agent that provides streaming mock responses for testing purposes.",
			vectorStoreEnabled: true,
			webSearchEnabled: false
		}
	}
	try {
		const { agents, conversations } = await import("./mockdb-data.js")
		console.log("./db/mockdb-data.js exists, loaded mockdb, returning mock collections")
		return { agents: [mockAgent, ...agents], conversations }
	} catch (error) {
		console.warn("./db/mockdb-data.js does not exist or is badly formed, returning empty collections", error)
		return { agents: [mockAgent], conversations: [] }
	}
}
