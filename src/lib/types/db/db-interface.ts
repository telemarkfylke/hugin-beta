import type { ChatConfig } from "$lib/types/chat"

export interface IChatConfigStore {
	getChatConfig(configId: string): Promise<ChatConfig | null>
	getChatConfigs(): Promise<ChatConfig[]>
	createChatConfig(ChatConfig: Omit<ChatConfig, "_id">): Promise<ChatConfig>
	updateChatConfig(configId: string, chatConfigUpdateInput: Partial<ChatConfig>): Promise<ChatConfig>
}
