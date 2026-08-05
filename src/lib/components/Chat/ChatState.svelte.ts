import { goto } from "$app/navigation"
import { chatHistoryToInputItems } from "$lib/chat-history"
import type { AppConfig } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { Chat, ChatConfig, ChatHistory, ChatRequest, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"
import type { InputFile, InputImage } from "$lib/types/chat-item-content"
import { postChatMessage } from "./PostChatMessage.svelte"

const fileToBase64Url = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.readAsDataURL(file)
		reader.onload = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result)
			} else {
				reject(new Error("Failed to convert file to Base64"))
			}
		}
		reader.onerror = (error) => reject(error)
	})
}

const fileToMessageContent = async (file: File, supportedFileTypes: string[], supportedImageTypes: string[]): Promise<InputFile | InputImage> => {
	let fileType: "image" | "file" | null = null
	if (supportedFileTypes.includes(file.type)) {
		fileType = "file"
	} else if (supportedImageTypes.includes(file.type)) {
		fileType = "image"
	} else {
		throw new Error(`File type ${file.type} is not supported for upload`)
	}

	const base64Data = await fileToBase64Url(file)

	if (fileType === "image") {
		return {
			type: "input_image",
			imageUrl: base64Data
		}
	}
	return {
		type: "input_file",
		fileName: file.name,
		fileUrl: base64Data
	}
}

const STORE_CHAT_STORAGE_KEY = "hugin_default_store_chat"

const getDefaultStoreChat = (): boolean => {
	if (typeof localStorage === "undefined") {
		return true
	}
	const saved = localStorage.getItem(STORE_CHAT_STORAGE_KEY)
	return saved === null ? true : saved === "true"
}

const placeHolderConfig: ChatConfig = {
	_id: "",
	name: "",
	description: "",
	vendorId: "MISTRAL",
	project: "",
	accessGroups: ["all"],
	type: "private",
	created: {
		at: "",
		by: {
			id: "",
			name: undefined
		}
	},
	updated: {
		at: "",
		by: {
			id: "",
			name: undefined
		}
	}
}

export class ChatState {
	public chat: Chat = $state({
		_id: "",
		config: placeHolderConfig,
		history: [] as ChatHistory,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		owner: {
			id: "",
			name: ""
		}
	})
	public streamResponse: boolean = $state(true)
	public storeChat: boolean = $state(getDefaultStoreChat())
	public isLoading: boolean = $state(false)
	public user: AuthenticatedPrincipal
	public APP_CONFIG: AppConfig
	public configMode: boolean = $state(false)
	public initialConfig: ChatConfig = $state(placeHolderConfig)
	public configEdited: boolean = $derived(JSON.stringify(this.chat.config) !== JSON.stringify(this.initialConfig))
	public webSearchEnabled: boolean = $state(false)
	public datasourceEnabled: boolean = $state(false)

	constructor(chat: Chat, user: AuthenticatedPrincipal, appConfig: AppConfig) {
		this.user = user
		this.APP_CONFIG = appConfig
		this.changeChat(chat)
	}

	public changeChat = (chat: Chat): void => {
		if (!chat) {
			throw new Error("ChatState requires a Chat object")
		}
		if (!chat.config.vendorAgent?.id && !chat.config.model) {
			throw new Error("Chat config must have either a vendorAgent id or a model defined")
		}
		this.chat._id = chat._id
		this.chat.config = chat.config
		this.chat.history = chat.history
		this.chat.createdAt = chat.createdAt
		this.chat.updatedAt = chat.updatedAt
		this.chat.owner = chat.owner
		this.initialConfig = JSON.parse(JSON.stringify(chat.config))
		this.webSearchEnabled = false
		this.datasourceEnabled = false
	}

	// Fire-and-forget - the endpoint is idempotent (no-ops if a title already exists), so callers
	// never need to know in advance whether one is needed.
	private requestTitleGeneration = (conversationId: string): void => {
		fetch(`/api/conversations/${conversationId}/title`, { method: "POST" }).catch((error) => {
			console.error("Error requesting conversation title generation:", error)
		})
	}

	public newChat = (): void => {
		if (this.chat._id && this.chat.history.length > 0) {
			this.requestTitleGeneration(this.chat._id)
		}
		this.chat.history = []
		this.chat._id = ""
		this.chat.createdAt = new Date().toISOString()
		this.chat.updatedAt = new Date().toISOString()
	}

	public toggleStoreChat = (): void => {
		this.storeChat = !this.storeChat
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(STORE_CHAT_STORAGE_KEY, String(this.storeChat))
		}
	}

	public loadChat = async (conversationId: string): Promise<void> => {
		this.isLoading = true
		try {
			const result = await fetch(`/api/conversations/${conversationId}`)
			if (!result.ok) {
				throw new Error(`Failed to load conversation: ${result.status} ${result.statusText}`)
			}
			const data: { conversation: { id: string; owner: string; title?: string; createdAt: string; updatedAt: string }; history: ChatHistory } = await result.json()

			const lastResponse = [...data.history].reverse().find((item): item is ChatResponseObject => item.type === "chat_response")

			this.changeChat({
				_id: data.conversation.id,
				config: lastResponse?.config ?? this.chat.config,
				history: data.history,
				createdAt: data.conversation.createdAt,
				updatedAt: data.conversation.updatedAt,
				owner: {
					id: data.conversation.owner
				}
			})

			if (!data.conversation.title) {
				this.requestTitleGeneration(data.conversation.id)
			}
		} finally {
			this.isLoading = false
		}
	}

	public promptChat = async (inputText: string, inputFiles: FileList) => {
		const userMessage: ChatInputItem = {
			type: "message.input",
			role: "user",
			content: []
		}

		// Process files if any
		if (inputFiles && inputFiles.length > 0) {
			const vendor = this.APP_CONFIG.VENDORS[this.chat.config.vendorId]
			if (!vendor) {
				throw new Error(`Vendor not found: ${this.chat.config.vendorId}`)
			}
			const model = vendor.MODELS.find((model) => model.ID === this.chat.config.model)
			if (!model) {
				throw new Error(`Model not found for vendor ${this.chat.config.vendorId}: ${this.chat.config.model}`)
			}
			const supportedFileTypes = model.SUPPORTED_MESSAGE_FILE_MIME_TYPES.FILE
			const supportedImageTypes = model.SUPPORTED_MESSAGE_FILE_MIME_TYPES.IMAGE

			for (const file of Array.from(inputFiles)) {
				const messageContent = await fileToMessageContent(file, supportedFileTypes, supportedImageTypes)
				userMessage.content.push(messageContent)
			}
		}

		// Add text input
		userMessage.content.push({
			type: "input_text",
			text: inputText
		})

		const chatInput = chatHistoryToInputItems(this.chat.history)

		const webSearchTools: typeof this.chat.config.tools = this.webSearchEnabled
			? [{ type: "web_search" }, ...(this.chat.config.tools?.filter((t) => t.type !== "web_search") ?? [])]
			: this.chat.config.tools?.filter((t) => t.type !== "web_search")

		const hasDatasources = (this.chat.config.dataSources?.length ?? 0) > 0
		const activeTools: typeof this.chat.config.tools =
			hasDatasources && this.datasourceEnabled ? [{ type: "datasource" }, ...(webSearchTools?.filter((t) => t.type !== "datasource") ?? [])] : webSearchTools?.filter((t) => t.type !== "datasource")

		const chatRequest: ChatRequest = {
			config: {
				...this.chat.config,
				name: this.chat.config.name || this.chat.config.model || "Ukjent navn",
				tools: activeTools
			},
			// Uten lagring (store=false) har backend ingen historikk å bygge kontekst fra, så da må vi fortsatt sende hele samtalen selv.
			inputs: this.storeChat ? [userMessage] : [...chatInput, userMessage],
			stream: this.streamResponse,
			store: this.storeChat,
			huginConversationId: this.storeChat ? this.chat._id || undefined : undefined
		}

		this.chat.history.push(userMessage)

		const tempChatResponseObject: ChatResponseObject = {
			id: `temp_id_${Date.now()}`,
			type: "chat_response",
			config: chatRequest.config,
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

	public saveChatConfig = async (): Promise<void> => {
		try {
			const result = await fetch(`/api/chatconfigs`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(this.chat.config)
			})
			if (!result.ok) {
				const errorData = await result.json()
				throw new Error(`Failed to save chat config: ${result.status} ${result.statusText} - ${errorData.message || JSON.stringify(errorData)}`)
			}
			const savedConfig: ChatConfig = await result.json()
			goto(`/agents/${savedConfig._id}`)
		} catch (error) {
			console.error("Error saving chat config:", error)
			throw error
		}
	}

	public updateChatConfig = async (): Promise<void> => {
		try {
			const result = await fetch(`/api/chatconfigs/${this.chat.config._id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(this.chat.config)
			})
			if (!result.ok) {
				const errorData = await result.json()
				throw new Error(`Failed to update chat config: ${result.status} ${result.statusText} - ${errorData.message || JSON.stringify(errorData)}`)
			}
			const updatedConfig: ChatConfig = await result.json()
			this.chat.config = updatedConfig
			this.initialConfig = JSON.parse(JSON.stringify(updatedConfig))
			this.configMode = false
		} catch (error) {
			console.error("Error updating chat config:", error)
			throw error
		}
		goto(`/agents/${this.chat.config._id}`)
	}

	public deleteChatConfig = async (): Promise<void> => {
		const confirmDelete = confirm("Er du sikker på at du vil slette denne assistenten? Dette kan ikke angres. 😬")
		if (!confirmDelete) {
			return
		}

		try {
			const result = await fetch(`/api/chatconfigs/${this.chat.config._id}`, {
				method: "DELETE"
			})
			if (!result.ok) {
				const errorData = await result.json()
				throw new Error(`Failed to delete chat config: ${result.status} ${result.statusText} - ${errorData.message || JSON.stringify(errorData)}`)
			}
			goto(`/agents`)
		} catch (error) {
			console.error("Error deleting chat config:", error)
			throw error
		}
	}
}
