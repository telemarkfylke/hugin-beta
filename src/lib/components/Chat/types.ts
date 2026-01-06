import type { ChatConfig, ChatInput } from "$lib/types/chat";

export type ConfigurableChatConfig = Omit<ChatConfig, "inputs">
export type ChatItems = Record<string, ChatInput>