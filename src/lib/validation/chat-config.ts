import type { ChatConfig, NewChatConfig } from "$lib/types/chat"

export const omitChatConfigId = (chatConfig: ChatConfig): NewChatConfig => {
	const { _id: ignoredId, ...newChatConfig } = chatConfig
	void ignoredId
	return newChatConfig
}
