import type { ChatConfig, ChatResponseObject, ChatResponseStream } from "./chat"

export type AIVendor = {
	id: string
	name: string
	description: string
	models: {
		supported: string[]
		default: string
	}
}

// VENDOR INTERFACE
export interface IAIVendor {
	/** Returns some static info about the AI Vendor */
	getInfo(): AIVendor
	/** Creates a chat response based on the given prompt request */
	createChatResponse(config: ChatConfig): Promise<ChatResponseObject>
	createChatResponseStream(config: ChatConfig): Promise<ChatResponseStream>
}
