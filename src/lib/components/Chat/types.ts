import type { ChatConfig, ChatInputMessage, ChatResponseObject, ChatInput } from "$lib/types/chat"

export type ConfigurableChatConfig = Omit<ChatConfig, "inputs">
export type ChatMessages = Array<ChatResponseObject | ChatInputMessage>
