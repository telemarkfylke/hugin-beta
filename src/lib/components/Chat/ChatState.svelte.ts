import { goto } from "$app/navigation"
import { buildChatRequest } from "$lib/client/chat/build-chat-request"
import { deleteChatConfig as apiDeleteChatConfig, saveChatConfig as apiSaveChatConfig, updateChatConfig as apiUpdateChatConfig } from "$lib/client/chat/chat-config-client"
import type { AppConfig } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { Chat, ChatConfig, ChatHistory, ChatResponseObject } from "$lib/types/chat"
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
	public storeChat: boolean = $state(false)
	public isLoading: boolean = $state(false)
	public user: AuthenticatedPrincipal
	public APP_CONFIG: AppConfig
	public configMode: boolean = $state(false)
	public initialConfig: ChatConfig = $state(placeHolderConfig)
	public configEdited: boolean = $derived(JSON.stringify(this.chat.config) !== JSON.stringify(this.initialConfig))
	public webSearchEnabled: boolean = $state(false)

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
		this.initialConfig = structuredClone(chat.config)
		this.webSearchEnabled = false
	}

	public newChat = (): void => {
		this.chat.history = []
		this.chat._id = ""
		this.chat.createdAt = new Date().toISOString()
		this.chat.updatedAt = new Date().toISOString()
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

		const chatRequest = buildChatRequest(this.chat, userMessage, this.webSearchEnabled, this.streamResponse, this.storeChat)

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
		const savedConfig = await apiSaveChatConfig(this.chat.config)
		goto(`/agents/${savedConfig._id}`)
	}

	public updateChatConfig = async (): Promise<void> => {
		const updatedConfig = await apiUpdateChatConfig(this.chat.config)
		this.chat.config = updatedConfig
		this.initialConfig = structuredClone(updatedConfig)
		this.configMode = false
		goto(`/agents/${updatedConfig._id}`)
	}

	public deleteChatConfig = async (): Promise<void> => {
		const confirmed = confirm("Er du sikker på at du vil slette denne assistenten? Dette kan ikke angres. 😬")
		if (!confirmed) return
		await apiDeleteChatConfig(this.chat.config._id)
		goto("/agents")
	}
}
