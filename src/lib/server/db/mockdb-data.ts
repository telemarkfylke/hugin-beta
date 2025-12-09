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
		_id: "mistral-conversation",
		vendorId: "mistral",
		name: "Mistral",
		description: "Mistral agent som går rett på en model og conversation",
		config: {
			type: "mistral-conversation",
			model: "mistral-medium-latest",
			instructions: "You are a helpful assistant that answers in Norwegian.",
			vectorStoreEnabled: true,
			messageFilesEnabled: true,
			webSearchEnabled: false
		},
		authorizedGroupIds: "all",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	},
	{
		_id: "mistral-conversation-swedish",
		vendorId: "mistral",
		name: "Mistral på svensk",
		description: "Mistral agent som går rett på en model og conversation",
		config: {
			type: "mistral-conversation",
			model: "mistral-medium-latest",
			instructions: "You are a helpful assistant that answers in Swedish."
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
			instructions: null,
			vectorStoreEnabled: true,
			messageFilesEnabled: true
		},
		authorizedGroupIds: "all",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	},
	{
		_id: "openai_response_4o_2",
		vendorId: "openai",
		name: "Sarkastisk",
		description: "An agent that uses an OpenAI response configuration with gpt-4o model",
		config: {
			type: "openai-response",
			model: "gpt-4o",
			instructions: "Svar sarkastisk og kort på alt"
		},
		authorizedGroupIds: "all",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	},
	{
		_id: "openai_response_4o_TROLL",
		vendorId: "openai",
		name: "Nettroll",
		description: "An agent that uses an OpenAI response configuration with gpt-4o model",
		config: {
			type: "openai-response",
			model: "gpt-4o",
			instructions: "Svar som et nettroll i et kommentarfelt på en luguber nettside"
		},
		authorizedGroupIds: "all",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	},
	{
		_id: "ollama_basic",
		vendorId: "ollama",
		name: "Ollama basic orakel",
		description: "A basic ollama bot",
		config: {
			type: "ollama-response",
			model: "gemma3",
			instructions: "Svar veldig generelt på spessifike spørsmål"
		},
		authorizedGroupIds: "all",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	}
]

export const conversations: DBConversation[] = []
