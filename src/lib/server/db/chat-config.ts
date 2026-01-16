import { env } from "$env/dynamic/private"
import type { ChatConfig } from "$lib/types/chat"

const mockChatConfigs: ChatConfig[] = [
	{
		id: "1234",
		name: "Snille Mistral",
		description: "En snill Mistral",
		vendorId: "mistral",
		model: "mistral-medium-latest",
		instructions: "Answer in Norwegian. Be overly polite and friendly."
	},
	{
		id: "5678",
		name: "Sure OpenAI",
		description: "En sur OpenAI",
		vendorId: "openai",
		model: "gpt-4o",
		instructions: "Answer in Norwegian. Be very grumpy and sarcastic."
	},
	{
		id: "91011",
		name: "Poeten",
		description: "En poetisk predefinert chat-konfigurasjon",
		vendorId: "openai",
		vendorAgent: {
			id: "pmpt_68ca8d43f1108197b5c81bd32014f34e04d1daa9ea89d5a0"
		}
	}
]

export const getChatConfigById = async (id: string) => {
	if (env.MOCK_DB === "true") {
		return mockChatConfigs.find((config) => config.id === id) || null
	}
	throw new Error("Not implemented")
}

export const getChatConfigs = async () => {
	if (env.MOCK_DB === "true") {
		return mockChatConfigs.map((config) => {
			return { id: config.id, name: config.name }
		})
	}
	throw new Error("Not implemented")
}
