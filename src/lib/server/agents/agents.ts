import { env } from "$env/dynamic/private"
import type { DBAgent, IAgent } from "$lib/types/agents.ts"
import type { AuthenticatedUser } from "$lib/types/authentication.js"
import { canViewAllAgents } from "../auth/authorization.js"
import { MistralAgent } from "../mistral/mistral-agent.js"
import { MockAIAgent } from "../mock-ai/mock-ai-agent"
import { OllamaAgent } from "../ollama/ollama-agent"
import { OpenAIAgent } from "../openai/openai-agent"

let mockDbData = null

if (env.MOCK_DB === "true") {
	const { getMockDb } = await import("$lib/server/db/mockdb.js")
	mockDbData = await getMockDb()
	// console.log(mockDbData)
}

export const getDBAgent = async (agentId: string): Promise<DBAgent> => {
	if (mockDbData) {
		const foundAgent = mockDbData.agents.find((agent) => agent._id === agentId)
		if (!foundAgent) {
			throw new Error("Agent not found")
		}
		return JSON.parse(JSON.stringify(foundAgent)) // Return a deep copy for not reference issues
	}
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB fetch here
}

/**
 * Handles authorization when fetching agents from DB, for faster retrieval. Probs a smarter solution somewhere...
 * @param {AuthenticatedUser} user 
 * @returns {Promise<DBAgent[]>}
 */
export const getDBAgents = async (user: AuthenticatedUser): Promise<DBAgent[]> => {
	if (mockDbData) {
		if (canViewAllAgents(user)) {
			return mockDbData.agents.map((agent) => JSON.parse(JSON.stringify(agent)))
		}
		const authorizedAgents = mockDbData.agents.filter(agent => {
			if (agent.authorizedGroupIds === "all") {
				return true
			}
			return user.groups.some((groupId) => agent.authorizedGroupIds.includes(groupId))
		})
		return authorizedAgents.map((agent) => JSON.parse(JSON.stringify(agent)))
	}
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB fetch here
}

export const createAgent = (dbAgent: DBAgent): IAgent => {
	if (dbAgent.config.type === "mock-agent") {
		return new MockAIAgent()
	}
	if (dbAgent.config.type === "mistral-conversation" || dbAgent.config.type === "mistral-agent") {
		return new MistralAgent(dbAgent)
	}
	if (dbAgent.config.type === "openai-response" || dbAgent.config.type === "openai-prompt") {
		return new OpenAIAgent(dbAgent)
	}
	if (dbAgent.config.type === "ollama-response") {
		return new OllamaAgent(dbAgent)
	}
	throw new Error(`Unsupported agent: ${dbAgent.name}`)
}
