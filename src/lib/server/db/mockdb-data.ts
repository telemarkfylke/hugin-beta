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
		_id: "mock-agent",
		name: "Mock AI Agent",
		vendorId: "mock-ai",
		description: "Mock AI agent, which responds with streaming mock data (no real AI or cost)",
		config: {
			type: "manual",
			model: "mock-model-v1",
			instructions: ["You are a mock AI agent that provides streaming mock responses for testing purposes."],
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
	},
	{
		_id: "mistral-conversation",
		vendorId: "mistral",
		name: "Mistral",
		description: "Mistral agent som går rett på en model og conversation",
		config: {
			type: "manual",
			model: "mistral-medium-latest",
			instructions: ["You are a helpful assistant that answers in Norwegian."],
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
		_id: "openai-drit",
		vendorId: "openai",
		name: "OpenAI Drit",
		description: "OpenAI agent som er kul",
		config: {
			type: "manual",
			model: "gpt-4o",
			instructions: ["You are a helpful assistant that answers in Swedish."]
		},
		authorizedGroupIds: ["dfjklsdf"],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	},
	{
		_id: "opeanai-predefined",
		vendorId: "openai",
		name: "OpenAI Predefinert",
		description: "OpenAI agent som er kul igjen",
		config: {
			type: "predefined",
			vendorAgent: {
				id: "pmpt_68ca8d43f1108197b5c81bd32014f34e04d1daa9ea89d5a0"
			}
		},
		authorizedGroupIds: ["dfjklsdf"],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	},
	{
		_id: "ollama fotballsupperter",
		vendorId: "openai",
		name: "Ollama fotballsuppoerter",
		description: "Ollama basert fotball suppoerter",
		config: {
			type: "manual",
			model: "gemma3",
			instructions: ["Svar som en ihuga Arsenal supporter som stadig svarer på spørsmål med en innskutt fotball referanse eller metafor"]
		},
		authorizedGroupIds: [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	}
]

export const conversations: DBConversation[] = []
