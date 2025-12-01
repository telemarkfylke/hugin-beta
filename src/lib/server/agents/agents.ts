import { env } from "$env/dynamic/private"
import type { DBAgent, IAgent } from "$lib/types/agents.ts"
import { MistralAgent } from "../mistral/mistral"
import { MockAIAgent } from "../mock-ai/mock-ai"
import { OllamaAgent } from "../ollama/ollama"
import { OpenAIAgent } from "../openai/openai"

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
		return JSON.parse(JSON.stringify(foundAgent))
	}
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB fetch here
}

export const getDBAgents = async (): Promise<DBAgent[]> => {
	if (mockDbData) {
		console.log("Returning agents from mockDbData", mockDbData.agents)
		return mockDbData.agents.map((agent) => JSON.parse(JSON.stringify(agent)))
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
