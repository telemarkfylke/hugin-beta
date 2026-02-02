import type { ChatConfig, NewChatConfig } from "$lib/types/chat"
import type { AuthenticatedPrincipal } from "../authentication"

export interface IChatConfigStore {
	getChatConfig(configId: string): Promise<ChatConfig | null>
	getChatConfigs(principal: AuthenticatedPrincipal): Promise<ChatConfig[]>
	getChatConfigsByVendorAgentId(vendorAgentId: string): Promise<ChatConfig[]>
	createChatConfig(chatConfig: NewChatConfig): Promise<ChatConfig>
	replaceChatConfig(configId: string, chatConfig: ChatConfig): Promise<ChatConfig>
	deleteChatConfig(configId: string): Promise<void>
}
