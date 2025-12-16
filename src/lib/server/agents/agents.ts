import { env } from "$env/dynamic/private"
import { DBAgent, type DBAgentPatchInput, type DBAgentPostInput, type DBAgentPutInput, type IAgent } from "$lib/types/agents.ts"
import type { AuthenticatedUser } from "$lib/types/authentication.js"
import { canViewAllAgents } from "../auth/authorization.js"
import { HTTPError } from "../middleware/http-error.js"
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
			throw new HTTPError(404, `Agent ${agentId} not found`)
		}
		return JSON.parse(JSON.stringify(foundAgent)) // Return a deep copy for not reference issues
	}
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB fetch here
}

export const getDBAgents = async (user: AuthenticatedUser): Promise<DBAgent[]> => {
	if (mockDbData) {
		if (canViewAllAgents(user)) {
			return mockDbData.agents.map((agent) => JSON.parse(JSON.stringify(agent)))
		}
		const authorizedAgents = mockDbData.agents.filter((agent) => {
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

export const createDBAgent = async (user: AuthenticatedUser, agentInput: DBAgentPostInput): Promise<DBAgent> => {
	const newAgent: Omit<DBAgent, "_id"> = {
		...agentInput,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy: {
			objectId: user.userId,
			name: user.name
		},
		updatedBy: {
			objectId: user.userId,
			name: user.name
		}
	}

	if (mockDbData) {
		const newMockAgent = { _id: crypto.randomUUID(), ...newAgent }
		mockDbData.agents.push(newMockAgent)
		return newMockAgent
	}

	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB here
}

export const patchDBAgent = async (agentId: string, agentUpdateInput: DBAgentPatchInput): Promise<DBAgent> => {
	if (mockDbData) {
		const agentToUpdate = mockDbData.agents.find((agent) => agent._id === agentId)
		if (!agentToUpdate) {
			throw new HTTPError(404, `Agent ${agentId} not found`)
		}
		for (const [key, value] of Object.entries(agentUpdateInput)) {
			// @ts-expect-error DETTE ER BARE MOCK
			agentToUpdate[key] = value
		}
		return JSON.parse(JSON.stringify(agentToUpdate)) // Return a deep copy for not reference issues
	}
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB update here
}

export const putDBAgent = async (user: AuthenticatedUser, agentInput: DBAgentPutInput, agentToReplace: DBAgent): Promise<DBAgent> => {
	const newAgent: DBAgent = {
		_id: agentToReplace._id,
		...agentInput,
		vendorId: agentToReplace.vendorId,
		createdAt: agentToReplace.createdAt,
		updatedAt: new Date().toISOString(),
		createdBy: agentToReplace.createdBy,
		updatedBy: {
			objectId: user.userId,
			name: user.name
		}
	}

	try {
		DBAgent.parse(newAgent)
	} catch (zodError) {
		throw new HTTPError(400, "New DBAgent is invalid", zodError)
	}

	if (mockDbData) {
		const existingAgent = mockDbData.agents.find((agent) => agent._id === agentToReplace._id)
		if (!existingAgent) {
			throw new HTTPError(404, `Agent ${agentToReplace._id} not found`)
		}
		Object.assign(existingAgent, newAgent)
		return existingAgent
	}

	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB here
}

export const createAgent = (dbAgent: DBAgent): IAgent => {
	if (dbAgent.vendorId === "mock-ai") {
		return new MockAIAgent()
	}
	if (dbAgent.vendorId === "mistral") {
		return new MistralAgent(dbAgent)
	}
	if (dbAgent.vendorId === "openai") {
		return new OpenAIAgent(dbAgent)
	}
	if (dbAgent.vendorId === "ollama") {
		return new OllamaAgent(dbAgent)
	}
	throw new Error(`Unsupported agent: ${dbAgent.name}`)
}
