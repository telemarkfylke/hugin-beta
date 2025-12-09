import { env } from "$env/dynamic/private";
import type { DBAgent } from "$lib/types/agents.js"
import type { DBConversation } from "$lib/types/conversation.js"

export const getMockDb = async (): Promise<{ agents: DBAgent[]; conversations: DBConversation[] }> => {
	// We add the mock agent here so it is always present in the mock db
	const mockAgent: DBAgent = {
		_id: "mock-agent",
		name: "Mock AI Agent",
		vendorId: "mock-ai",
		description: "Mock AI agent, which responds with streaming mock data (no real AI or cost)",
		config: {
			type: "mock-agent",
			instructions: "You are a mock AI agent that provides streaming mock responses for testing purposes.",
			vectorStoreEnabled: true,
			webSearchEnabled: false
		},
		authorizedGroupIds: "all",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy: {
			objectId: "00000000-0000-0000-0000-000000000001",
			name: "Mock User"
		},
		updatedBy: {
			objectId: "00000000-0000-0000-0000-000000000001",
			name: "Mock User"
		}
	}
	try {
		const mockDbDataFile = env.TEST_MODE === "true" ? "./mockdb-test-data.js" : "./mockdb-data.js"
		const { agents, conversations } = await import(mockDbDataFile)
		console.log("./db/mockdb-data.js exists, loaded mockdb, returning mock collections")
		return { agents: [mockAgent, ...agents], conversations }
	} catch (error) {
		console.warn("./db/mockdb-data.js does not exist or is badly formed, returning empty collections", error)
		return { agents: [mockAgent], conversations: [] }
	}
}
