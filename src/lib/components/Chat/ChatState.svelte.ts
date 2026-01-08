import type { Chat, ChatHistory, ChatRequest, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"
import { postChatMessage } from "./PostChatMessage.svelte"

export class ChatState {
	public chat: Chat = $state({
		id: "",
		config: {
			id: "",
			name: "",
			description: "",
			vendorId: ""
		},
		history: [] as ChatHistory,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		owner: {
			id: "",
			name: ""
		}
	})
	public streamResponse: boolean = $state(true)
	public storeChat: boolean = $state(true)
	public isLoading: boolean = $state(false)

	constructor(chat: Chat) {
		this.changeChat(chat)
	}

	public changeChat = async (chat: Chat): Promise<void> => {
		if (!chat) {
			throw new Error("ChatState requires a Chat object")
		}
		if (!chat.config.vendorAgent?.id && !chat.config.model) {
			throw new Error("Chat config must have either a vendorAgent id or a model defined")
		}
		this.chat.id = chat.id
		this.chat.config = chat.config
		this.chat.history = chat.history
		this.chat.createdAt = chat.createdAt
		this.chat.updatedAt = chat.updatedAt
		this.chat.owner = chat.owner
	}

	public loadChat = async (chatId: string): Promise<void> => {
		// Fetch from API and update state
		this.isLoading = true
		// Sleep
		await new Promise((resolve) => setTimeout(resolve, 1000))
		this.isLoading = false
		// Mocked response
		const response: Chat = {
			id: chatId,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			owner: {
				id: "owner-id-123",
				name: "Owner Name"
			},
			config: {
				id: "config-id-123",
				name: "Example Chat Config",
				description: "This is an example chat configuration.",
				vendorId: "openai",
				model: "gpt-4"
			},
			history: [
				{
					type: "message.input",
					role: "user",
					content: [
						{
							type: "input_text",
							text: "Hello, how are you?"
						}
					]
				},
				{
					id: "response-id-123",
					type: "chat_response",
					config: {
						id: "config-id-123",
						name: "Example Chat Config",
						description: "This is an example chat configuration.",
						vendorId: "openai",
						model: "gpt-4"
					},
					createdAt: new Date().toISOString(),
					outputs: [
						{
							id: "output-message-id-123",
							type: "message.output",
							role: "assistant",
							content: [
								{
									type: "output_text",
									text: "I'm doing well, thank you!"
								}
							]
						}
					],
					status: "completed",
					usage: {
						inputTokens: 5,
						outputTokens: 7,
						totalTokens: 12
					}
				}
			]
		}
		this.changeChat(response)
	}

	public promptChat = async (inputText: string, _inputFiles: FileList) => {
		const userMessage: ChatInputItem = {
			type: "message.input",
			role: "user",
			content: [
				{
					type: "input_text",
					text: inputText
				}
			]
		}

		const chatInput = this.chat.history.flatMap(chatItem => {
			if (chatItem.type === "chat_response") {
				return chatItem.outputs
			}
			return chatItem
		}).filter((message) => message !== undefined)

		const chatRequest: ChatRequest = {
			config: this.chat.config,
			inputs: [...chatInput, userMessage],
			stream: this.streamResponse,
			store: this.storeChat
		}

		this.chat.history.push(userMessage)

		const tempChatResponseObject: ChatResponseObject = {
			id: `temp_id_${Date.now()}`,
			type: "chat_response",
			config: this.chat.config,
			createdAt: new Date().toISOString(),
			outputs: [],
			status: "queued",
			usage: {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0
			}
		}

		this.chat.history.push(tempChatResponseObject)
		const responseObjectToPopulate: ChatResponseObject = this.chat.history[this.chat.history.length - 1] as ChatResponseObject // The one we just pushed as it is first reactive after adding to state array
		await postChatMessage(chatRequest, responseObjectToPopulate, this.chat)
	}
}