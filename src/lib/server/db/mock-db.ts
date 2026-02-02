import { canViewAllChatConfigs } from "$lib/authorization"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig, NewChatConfig } from "$lib/types/chat"
import type { IChatConfigStore } from "$lib/types/db/db-interface"
import { APP_CONFIG } from "../app-config/app-config"

let mockChatConfigs: ChatConfig[] = [
	{
		_id: "1000",
		name: "Mistral",
		description: "Mistral er en kraftig europeisk variant av ChatGPT",
		vendorId: "MISTRAL",
		project: "DEFAULT",
		model: "mistral-large-latest",
		instructions: "",
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
		_id: "2000",
		name: "ChatGPT rask",
		description: "OpenAIs KI for rask og presis informasjon.",
		vendorId: "OPENAI",
		project: "DEFAULT",
		model: "gpt-4.1",
		instructions: "",
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
		_id: "3000",
		name: "ChatGPT tenker",
		description: "OpenAIs avanserte og nyeste KI for rask tenkning og resonnering.",
		vendorId: "OPENAI",
		project: "DEFAULT",
		model: "gpt-5.2",
		instructions: "",
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
	async getChatConfigs(principal: AuthenticatedPrincipal): Promise<ChatConfig[]> {
		if (canViewAllChatConfigs(principal, APP_CONFIG.APP_ROLES)) {
			return mockChatConfigs
		}
		return mockChatConfigs.filter((config) => {
			if (config.type === "private") {
				if (config.created.by.id === principal.userId) {
					return true
				}
				return false
			}
			if (config.accessGroups === "all") {
				return true
			}
			if (Array.isArray(config.accessGroups)) {
				return config.accessGroups.some((group) => principal.groups.includes(group))
			}
			return false
		})
	}
	async getChatConfigsByVendorAgentId(vendorAgentId: string): Promise<ChatConfig[]> {
		if (!vendorAgentId) {
			return []
		}
		return mockChatConfigs.filter((config) => config.vendorAgent?.id === vendorAgentId)
	}
	async createChatConfig(chatConfig: NewChatConfig): Promise<ChatConfig> {
		const newConfig: ChatConfig = { ...chatConfig, _id: Date.now().toString() }
		mockChatConfigs.push(newConfig)
		return newConfig
	}
	async replaceChatConfig(configId: string, chatConfig: NewChatConfig): Promise<ChatConfig> {
		const config = mockChatConfigs.find((config) => config._id === configId)
		if (!config) throw new Error("ChatConfig not found")
		Object.assign(config, chatConfig)
		return config
	}
	async deleteChatConfig(configId: string): Promise<void> {
		mockChatConfigs = mockChatConfigs.filter((config) => config._id !== configId)
	}
}
