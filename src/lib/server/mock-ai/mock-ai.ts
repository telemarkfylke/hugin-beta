import { createSse } from "$lib/streaming.js"
import type {
	AddConversationFilesResult,
	AppendToConversationResult,
	Conversation,
	CreateConversationResult,
	GetConversationMessagesResult,
	GetConversationVectorStoreFileContentResult,
	IAgent,
	Message
} from "$lib/types/agents"
import type { AgentPrompt, GetVectorStoreFilesResult } from "$lib/types/requests"
import { uploadFilesToMockAI } from "./mock-ai-files"

// Markdown works (could move out to md file if needed)
const mockAiResponse = `Hello, this is a mock AI response streaming to you!
  Here's some more information from the mock AI.
  
  Finally, this is the last part of the mock AI response.
`

const mockResponseTokens = mockAiResponse.split(" ").map((token) => `${token} `)

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const handleMockAiStream = (conversationId?: string): ReadableStream => {
	const messageId = `mock-message-${Date.now()}`
	const readableStream = new ReadableStream({
		async start(controller) {
			if (conversationId) {
				controller.enqueue(createSse({ event: "conversation.started", data: { conversationId } }))
			}
			for (const message of mockResponseTokens) {
				controller.enqueue(createSse({ event: "conversation.message.delta", data: { messageId, content: message } }))
				// Simuler litt delay mellom meldingene
				await sleep(50)
			}
			controller.enqueue(createSse({ event: "conversation.message.ended", data: { totalTokens: mockResponseTokens.length } }))
			controller.close()
		}
	})
	return readableStream
}

export class MockAIAgent implements IAgent {
	public async createConversation(conversation: Conversation, _initialPrompt: AgentPrompt, streamResponse: boolean): Promise<CreateConversationResult> {
		const relatedConversationId = `mock-related-conversation-${Date.now()}`
		const vectorStoreId = null // Mock agent does not use vector store
		if (streamResponse) {
			const readableStream = handleMockAiStream(conversation._id)
			return { relatedConversationId, response: readableStream, vectorStoreId }
		}
		// For non-streaming, return full response at once (not implemented here)
		throw new Error("Non-streaming response not implemented in MockAIAgent")
	}
	public async appendMessageToConversation(conversation: Conversation, _prompt: AgentPrompt, streamResponse: boolean): Promise<AppendToConversationResult> {
		if (streamResponse) {
			const readableStream = handleMockAiStream(conversation._id)
			return { response: readableStream }
		}
		// For non-streaming, return full response at once (not implemented here)
		throw new Error("Non-streaming response not implemented in MockAIAgent")
	}
	public async addConversationVectorStoreFiles(conversation: Conversation, files: File[], streamResponse: boolean): Promise<AddConversationFilesResult> {
		if (streamResponse) {
			const readableStream = await uploadFilesToMockAI(conversation.vectorStoreId || `mock-vector-store-${conversation._id}`, files, true)
			return { response: readableStream }
		}
		throw new Error("Non-streaming add files not implemented in MockAIAgent")
	}
	public async getConversationVectorStoreFiles(_conversation: Conversation): Promise<GetVectorStoreFilesResult> {
		throw new Error("Method not implemented in MockAIAgent")
	}

	public async getConversationVectorStoreFileContent(_conversation: Conversation, _fileId: string): Promise<GetConversationVectorStoreFileContentResult> {
		throw new Error("Method not implemented in MockAIAgent")
	}
	public async deleteConversationVectorStoreFile(_conversation: Conversation, _fileId: string): Promise<void> {
		throw new Error("Method not implemented in MockAIAgent")
	}
	public async getConversationMessages(_conversation: Conversation): Promise<GetConversationMessagesResult> {
		const mockMessages: Message[] = [
			{
				id: `mock-message-1`,
				type: "message",
				status: "completed",
				role: "user",
				content: {
					type: "inputText",
					text: "Hello, Mock AI!"
				}
			},
			{
				id: `mock-message-2`,
				type: "message",
				status: "completed",
				role: "agent",
				content: {
					type: "outputText",
					text: "Hello, this is a response from Mock AI."
				}
			},
			{
				id: `mock-message-3`,
				type: "message",
				status: "completed",
				role: "user",
				content: {
					type: "inputText",
					text: "Can you help me with something?"
				}
			},
			{
				id: `mock-message-4`,
				type: "message",
				status: "completed",
				role: "agent",
				content: {
					type: "outputText",
					text: "no"
				}
			}
		]
		return { messages: mockMessages }
	}
}
