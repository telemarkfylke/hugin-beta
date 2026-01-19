import type { ChatConfig } from "$lib/types/chat"
import type { IChatConfigStore } from "$lib/types/db/db-interface"

const mockChatConfigs: ChatConfig[] = [
	{
		_id: "1234",
		name: "Snille Mistral",
		description: "En snill Mistral",
		vendorId: "MISTRAL",
		project: "DEFAULT",
		model: "mistral-medium-latest",
		instructions: "Answer in Norwegian. Be overly polite and friendly.",
		accessGroups: "all",
		type: "published",
		created: {
			at: new Date().toISOString(),
			by: {
				id: "system"
			}
		},
		updated: {
			at: new Date().toISOString(),
			by: {
				id: "system"
			}
		}
	},
	{
		_id: "5678",
		name: "Sure OpenAI",
		description: "En sur OpenAI",
		vendorId: "OPENAI",
		project: "DEFAULT",
		model: "gpt-4o",
		instructions: "Answer in Norwegian. Be very grumpy and sarcastic.",
		accessGroups: "all",
		type: "published",
		created: {
			at: new Date().toISOString(),
			by: {
				id: "system"
			}
		},
		updated: {
			at: new Date().toISOString(),
			by: {
				id: "system"
			}
		}
	}
]

export class MockChatConfigStore implements IChatConfigStore {
	async getChatConfig(configId: string): Promise<ChatConfig | null> {
		const config = mockChatConfigs.find((config) => config._id === configId) || null
		return config
	}
	async getChatConfigs(): Promise<ChatConfig[]> {
		return mockChatConfigs
	}
	async getChatConfigsByVendorAgentId(vendorAgentId: string): Promise<ChatConfig[]> {
		if (!vendorAgentId) {
			return []
		}
		return mockChatConfigs.filter((config) => config.vendorAgent?.id === vendorAgentId)
	}
	async createChatConfig(chatConfig: Omit<ChatConfig, "_id">): Promise<ChatConfig> {
		const newConfig: ChatConfig = { ...chatConfig, _id: Date.now().toString() }
		mockChatConfigs.push(newConfig)
		return newConfig
	}
	async replaceChatConfig(configId: string, chatConfig: ChatConfig): Promise<ChatConfig> {
		const config = mockChatConfigs.find((config) => config._id === configId)
		if (!config) throw new Error("ChatConfig not found")
		Object.assign(config, chatConfig)
		return config
	}
}
