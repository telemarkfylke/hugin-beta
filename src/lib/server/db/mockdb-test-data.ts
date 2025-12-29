// simply in-memory mock database used when runnning tests

import type { VectorChunk } from "$lib/server/db/vectorstore/types"
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
		_id: "test-agent-1",
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
		_id: "test-agent-2",
		vendorId: "mistral",
		name: "Mistral på svensk",
		description: "Mistral agent som går rett på en model og conversation",
		config: {
			type: "manual",
			model: "mistral-medium-latest",
			instructions: ["You are a helpful assistant that answers in Swedish."]
		},
		authorizedGroupIds: ["test-agent-2-group"],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	},
	{
		_id: "test-agent-3",
		vendorId: "openai",
		name: "Open AI demo agent",
		description: "An agent that uses an OpenAI response configuration with gpt-4o model",
		config: {
			type: "manual",
			model: "gpt-4o",
			instructions: ["halla"],
			vectorStoreEnabled: true,
			messageFilesEnabled: true
		},
		authorizedGroupIds: ["test-agent-3-group"],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	},
	{
		_id: "test-agent-4",
		vendorId: "openai",
		name: "Open AI demo agent",
		description: "An agent that uses an OpenAI response configuration with gpt-4o model",
		config: {
			type: "manual",
			model: "gpt-4o",
			instructions: ["halla"],
			vectorStoreEnabled: true,
			messageFilesEnabled: true
		},
		authorizedGroupIds: ["test-agent-4-group"],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy,
		updatedBy
	}
]

export const conversations: DBConversation[] = []

export const vectors: Record<string, VectorChunk[]> = {}
