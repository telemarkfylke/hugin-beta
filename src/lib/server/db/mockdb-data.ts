// simply in-memory mock database corresponding to collections in mongodb

import type { Conversation, DBAgent } from "$lib/types/agents.ts"

export const agents: DBAgent[] = [
	{
		_id: "mistral-conversation",
		name: "Mistral",
		description: "Mistral agent som går rett på en model og conversation",
		config: {
			type: "mistral-conversation",
			model: "mistral-medium-latest",
			instructions: "You are a helpful assistant that answers in Norwegian.",
			vectorStoreEnabled: true,
			messageFilesEnabled: true,
			webSearchEnabled: false
		}
	},
	{
		_id: "mistral-conversation-swedish",
		name: "Mistral på svensk",
		description: "Mistral agent som går rett på en model og conversation",
		config: {
			type: "mistral-conversation",
			model: "mistral-medium-latest",
			instructions: "You are a helpful assistant that answers in Swedish."
		}
	},
	{
		_id: "openai_response_4o",
		name: "Open AI demo agent",
		description: "An agent that uses an OpenAI response configuration with gpt-4o model",
		config: {
			type: "openai-response",
			model: "gpt-4o",
			instructions: null,
			vectorStoreEnabled: true,
			messageFilesEnabled: true
		}
	},
	{
		_id: "openai_response_4o_2",
		name: "Sarkastisk",
		description: "An agent that uses an OpenAI response configuration with gpt-4o model",
		config: {
			type: "openai-response",
			model: "gpt-4o",
			instructions: "Svar sarkastisk og kort på alt"
		}
	},
	{
		_id: "openai_response_4o_TROLL",
		name: "Nettroll",
		description: "An agent that uses an OpenAI response configuration with gpt-4o model",
		config: {
			type: "openai-response",
			model: "gpt-4o",
			instructions: "Svar som et nettroll i et kommentarfelt på en luguber nettside"
		}
	},
	{
		_id: "ollama_basic",
		name: "Ollama basic orakel",
		description: "A basic ollama bot",
		config: {
			type: "ollama-response",
			model: "gemma3",
			instructions: "Svar veldig generelt på spessifike spørsmål"
		}
	}
]

export const conversations: Conversation[] = []
