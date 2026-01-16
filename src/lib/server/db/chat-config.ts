import { env } from "$env/dynamic/private"
<<<<<<< HEAD
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
=======
>>>>>>> origin/main
import type { ChatConfig } from "$lib/types/chat"

const mockChatConfigs: ChatConfig[] = [
	{
		id: "1234",
		name: "Snille Mistral",
		description: "En snill Mistral",
		vendorId: "mistral",
<<<<<<< HEAD
		project: "DEFAULT",
=======
>>>>>>> origin/main
		model: "mistral-medium-latest",
		instructions: "Answer in Norwegian. Be overly polite and friendly."
	},
	{
		id: "5678",
		name: "Sure OpenAI",
		description: "En sur OpenAI",
		vendorId: "openai",
<<<<<<< HEAD
		project: "DEFAULT",
=======
>>>>>>> origin/main
		model: "gpt-4o",
		instructions: "Answer in Norwegian. Be very grumpy and sarcastic."
	},
	{
		id: "91011",
<<<<<<< HEAD
		name: "Matematikkens byggesteiner",
		description: "En agent som hjelper med matematikkoppgaver fra læreboken Matematikkens byggesteiner.",
		vendorId: "openai",
		project: "DEFAULT",
		vendorAgent: {
			id: "pmpt_696a20e000a08197a4d761228637a2310abd4054c958b64c"
=======
		name: "Poeten",
		description: "En poetisk predefinert chat-konfigurasjon",
		vendorId: "openai",
		vendorAgent: {
			id: "pmpt_68ca8d43f1108197b5c81bd32014f34e04d1daa9ea89d5a0"
>>>>>>> origin/main
		}
	}
]

<<<<<<< HEAD
export const getChatConfigById = async (id: string, _principal: AuthenticatedPrincipal) => {
=======
export const getChatConfigById = async (id: string) => {
>>>>>>> origin/main
	if (env.MOCK_DB === "true") {
		return mockChatConfigs.find((config) => config.id === id) || null
	}
	throw new Error("Not implemented")
}

<<<<<<< HEAD
export const getChatConfigs = async (_principal: AuthenticatedPrincipal): Promise<ChatConfig[]> => {
	if (env.MOCK_DB === "true") {
		return mockChatConfigs
			.filter((_config) => {
				return true
			})
			.map((config) => {
				return config
			})
=======
export const getChatConfigs = async () => {
	if (env.MOCK_DB === "true") {
		return mockChatConfigs.map((config) => {
			return { id: config.id, name: config.name }
		})
>>>>>>> origin/main
	}
	throw new Error("Not implemented")
}
