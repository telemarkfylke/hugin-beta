import type { ChatConfig } from "$lib/types/chat"

export interface IChatConfigStore {
	getChatConfig(configId: string): Promise<ChatConfig | null>
	getChatConfigs(): Promise<ChatConfig[]>
	createChatConfig(chatConfig: Omit<ChatConfig, "_id">): Promise<ChatConfig>
	replaceChatConfig(configId: string, chatConfig: ChatConfig): Promise<ChatConfig>
}
