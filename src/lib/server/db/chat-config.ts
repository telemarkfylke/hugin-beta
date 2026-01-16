import { env } from "$env/dynamic/private"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig } from "$lib/types/chat"

const mockChatConfigs: ChatConfig[] = [
	{
		id: "1234",
		name: "Snille Mistral",
		description: "En snill Mistral",
		vendorId: "mistral",
		project: "DEFAULT",
		model: "mistral-medium-latest",
		instructions: "Answer in Norwegian. Be overly polite and friendly."
	},
	{
		id: "5678",
		name: "Sure OpenAI",
		description: "En sur OpenAI",
		vendorId: "openai",
		project: "DEFAULT",
		model: "gpt-4o",
		instructions: "Answer in Norwegian. Be very grumpy and sarcastic."
	},
	{
		id: "91011",
		name: "Matematikkens byggesteiner",
		description: "En agent som hjelper med matematikkoppgaver fra læreboken Matematikkens byggesteiner.",
		vendorId: "openai",
		project: "DEFAULT",
		vendorAgent: {
			id: "pmpt_696a20e000a08197a4d761228637a2310abd4054c958b64c"
		}
	}
]

export const getChatConfigById = async (id: string, _principal: AuthenticatedPrincipal) => {
	if (env.MOCK_DB === "true") {
		return mockChatConfigs.find((config) => config.id === id) || null
	}
	throw new Error("Not implemented")
}

export const getChatConfigs = async (_principal: AuthenticatedPrincipal) => {
	if (env.MOCK_DB === "true") {
		return mockChatConfigs.filter((_config) => {
      return true
    })
    .map((config) => {
			return { id: config.id, name: config.name, description: config.description, vendorId: config.vendorId }
		})
	}
	throw new Error("Not implemented")
}
