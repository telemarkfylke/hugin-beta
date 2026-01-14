import type { ChatRequest, ChatResponseObject, ChatResponseStream } from "./chat"

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
	/** Creates a chat response based on the given prompt request */
	createChatResponse(chatRequest: ChatRequest): Promise<ChatResponseObject>
	createChatResponseStream(chatRequest: ChatRequest): Promise<ChatResponseStream>
}

// VENDOR HANDLE STREAM INTERFACE
export type IAIVendorStreamHandler<T> = (chatRequest: ChatRequest, stream: T) => ChatResponseStream
