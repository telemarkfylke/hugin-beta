// simply in-memory mock database corresponding to collections in mongodb

import type { DBAgent } from "$lib/types/agents.ts"
import type { DBConversation } from "$lib/types/conversation"

const createdBy = {
	objectId: "00000000-0000-0000-0000-000000000001",
	name: "Mock User"
}
const updatedBy = {
	objectId: "00000000-0000-0000-0000-000000000001",
	name: "Mock User"
}

export const agents: DBAgent[] = [
	{
		_id: "mistral",
		vendorId: "mistral",
		name: "Mistral demo agent",
		description: "Mistral agent based on an agent in mistral - connected to a mistral agent id",
		config: {
			type: "mistral-agent",
			agentId: "en id til en agent i mistral"
		},
		authorizedGroupIds: "all",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	},
	{
		_id: "mistral-conversation",
		vendorId: "mistral",
		name: "Mistral rett på conversation",
		description: "Mistral agent som går rett på en model og conversation",
		config: {
			type: "mistral-conversation",
			model: "mistral-medium-latest",
			instructions: "You are a helpful assistant that answers in Norwegian. Always search document libraries before answering user questions.",
			vectorStoreEnabled: true,
			webSearchEnabled: false,
			documentLibraryIds: ["preconfigured-library-id-from-mistral"]
		},
		authorizedGroupIds: "all",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	},
	{
		_id: "openai_prompt",
		vendorId: "openai",
		name: "Open AI prompt demo agent",
		description: "An agent that uses an OpenAI prompt-id as its configuration (saved prompt in OpenAI)",
		config: {
			type: "openai-prompt",
			prompt: {
				id: "a prompt id from OpenAI here",
				version: "optional version string"
			}
		},
		authorizedGroupIds: "all",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	},
	{
		_id: "openai_response_4o",
		vendorId: "openai",
		name: "Open AI demo agent",
		description: "An agent that uses an OpenAI response configuration with gpt-4o model",
		config: {
			type: "openai-response",
			model: "gpt-4o",
			instructions: "You are a helpful assistant that answers in Norwegian.",
			vectorStoreEnabled: true,
			webSearchEnabled: false
		},
		authorizedGroupIds: "all",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	}
]

export const conversations: DBConversation[] = []
