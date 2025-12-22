import { createSse } from "$lib/streaming.js"
import type { Agent, IAgent, IAgentResults } from "$lib/types/agents"
import type { DBConversation } from "$lib/types/conversation"
import type { AgentPrompt, Message } from "$lib/types/message"
import { MockAIVendor } from "./mock-ai"

const mockAiVendor = new MockAIVendor()

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

	public getAgentInfo(): Agent {
		throw new Error("Method not implemented in MockAIAgent")
	}

	public async createConversation(conversation: DBConversation, _initialPrompt: AgentPrompt, streamResponse: boolean): Promise<IAgentResults["CreateConversationResult"]> {
		const vendorConversationId = `mock-related-conversation-${Date.now()}`
		const vectorStoreId = null // Mock agent does not use vector store
		if (streamResponse) {
			const readableStream = handleMockAiStream(conversation._id)
			return { vendorConversationId, response: readableStream, vectorStoreId }
		}
		// For non-streaming, return full response at once (not implemented here)
		throw new Error("Non-streaming response not implemented in MockAIAgent")
	}

	public async appendMessageToConversation(conversation: DBConversation, _prompt: AgentPrompt, streamResponse: boolean): Promise<IAgentResults["AppendToConversationResult"]> {
		if (streamResponse) {
			const readableStream = handleMockAiStream(conversation._id)
			return { response: readableStream }
		}
		// For non-streaming, return full response at once (not implemented here)
		throw new Error("Non-streaming response not implemented in MockAIAgent")
	}

	public async addConversationVectorStoreFiles(conversation: DBConversation, files: File[], streamResponse: boolean): Promise<IAgentResults["AddConversationVectorStoreFilesResult"]> {
		if (streamResponse) {
			if (!conversation.vectorStoreId) {
				throw new Error("Conversation does not have a vector store ID to add files to")
			}
			return mockAiVendor.addVectorStoreFiles(conversation.vectorStoreId, files, true)
		}
		throw new Error("Non-streaming add files not implemented in MockAIAgent")
	}

	appendVectorStoreFiles(_files: File[], _streamResponse: boolean): Promise<IAgentResults["AddVectorStoreFilesResult"]> {
		throw new Error("Method not implemented.")
	}

	public async getConversationVectorStoreFiles(_conversation: DBConversation): Promise<IAgentResults["GetConversationVectorStoreFilesResult"]> {
		throw new Error("Method not implemented in MockAIAgent")
	}

	public async getConversationVectorStoreFileContent(_conversation: DBConversation, _fileId: string): Promise<IAgentResults["GetConversationVectorStoreFileContentResult"]> {
		throw new Error("Method not implemented in MockAIAgent")
	}

	public async deleteConversationVectorStoreFile(_conversation: DBConversation, _fileId: string): Promise<void> {
		throw new Error("Method not implemented in MockAIAgent")
	}

	public async getConversationMessages(_conversation: DBConversation): Promise<IAgentResults["GetConversationMessagesResult"]> {
		const mockMessages: Message[] = [
			{
				id: `mock-message-1`,
				type: "message",
				status: "completed",
				role: "user",
				content: [
					{
						type: "text",
						text: "Hello, Mock AI!"
					}
				]
			},
			{
				id: `mock-message-2`,
				type: "message",
				status: "completed",
				role: "agent",
				content: [
					{
						type: "text",
						text: "Hello, this is a response from Mock AI."
					}
				]
			},
			{
				id: `mock-message-3`,
				type: "message",
				status: "completed",
				role: "user",
				content: [
					{
						type: "text",
						text: "Can you help me with something?"
					}
				]
			},
			{
				id: `mock-message-4`,
				type: "message",
				status: "completed",
				role: "agent",
				content: [
					{
						type: "text",
						text: "no"
					}
				]
			}
		]
		return { messages: mockMessages }
	}
}
