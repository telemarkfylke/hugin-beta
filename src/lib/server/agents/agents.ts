import { type AgentConfig, DBAgent, type DBAgentPatchInput, type DBAgentPostInput, type DBAgentPutInput, type IAgent } from "$lib/types/agents.ts"
import type { AuthenticatedUser } from "$lib/types/authentication.js"
import type { DBConversation } from "$lib/types/conversation.js"
import { canViewAllAgents } from "../auth/authorization.js"
import type { NewAgentInput } from "../db/agents/interface.js"
import { getIocContainer } from "../ioc/container.js"
import { HTTPError } from "../middleware/http-error.js"
import { MistralAgent } from "../mistral/mistral-agent.js"
import { MockAIAgent } from "../mock-ai/mock-ai-agent"
import { OllamaAgent } from "../ollama/ollama-agent"
import { OpenAIAgent } from "../openai/openai-agent"

const agentStore = getIocContainer().agentStore

export const getDBAgent = async (agentId: string): Promise<DBAgent> => {
	const foundAgent = await agentStore.getAgent(agentId)
	if (foundAgent) {
		return foundAgent
	}
	throw new HTTPError(404, `Agent ${agentId} not found`)
}

export const getDBAgents = async (user: AuthenticatedUser): Promise<DBAgent[]> => {
	const agents = await agentStore.getAgents()
	if (canViewAllAgents(user)) {
		return agents
	}
	const authorizedAgents = agents.filter((agent) => {
		if (agent.authorizedGroupIds === "all") {
			return true
		}
		return user.groups.some((groupId) => agent.authorizedGroupIds.includes(groupId))
	})
	return authorizedAgents
}

export const createDBAgent = async (user: AuthenticatedUser, agentInput: DBAgentPostInput): Promise<DBAgent> => {
	const newAgent: NewAgentInput = {
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
	return await agentStore.createAgent(newAgent)
}

export const patchDBAgent = async (agentId: string, agentUpdateInput: DBAgentPatchInput): Promise<DBAgent> => {
	return await agentStore.updateAgent(agentId, agentUpdateInput)
}

// Jeg skjønner fremdeles ikke hvorfor vi trenger en PUT her når vi har patch. vbirker som dobbelt upkeep
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
	const existingAgent = agentStore.getAgent(agentToReplace._id)
	if (!existingAgent) {
		throw new HTTPError(404, `Agent ${agentToReplace._id} not found`)
	}

	return await agentStore.updateAgent(agentToReplace._id, agentInput)
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

export const combineVectorStores = (config: AgentConfig, conversation: DBConversation | null): string[] => {
	const vectorContexts: string[] = []
	if (conversation?.vectorStoreId) vectorContexts.push(conversation.vectorStoreId)

	if (config.type === "manual" && config.vectorStoreIds) vectorContexts.push(...config.vectorStoreIds)

	return vectorContexts
}
