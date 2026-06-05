import { Chat as AiChat } from "@ai-sdk/svelte"
import { DefaultChatTransport, type FileUIPart } from "ai"
import { goto } from "$app/navigation"
import type { AppConfig } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { Chat, ChatConfig } from "$lib/types/chat"

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
	public chatConfig: ChatConfig = $state(placeHolderConfig)
	public chatId: string = $state("")
	public chatCreatedAt: string = $state(new Date().toISOString())
	public chatUpdatedAt: string = $state(new Date().toISOString())
	public chatOwner: { id: string; name?: string | undefined } = $state({ id: "", name: undefined })
	public streamResponse: boolean = $state(true)
	public storeChat: boolean = $state(false)
	public user: AuthenticatedPrincipal
	public APP_CONFIG: AppConfig
	public configMode: boolean = $state(false)
	public initialConfig: ChatConfig = $state(placeHolderConfig)
	public configEdited: boolean = $derived(JSON.stringify(this.chatConfig) !== JSON.stringify(this.initialConfig))
	public webSearchEnabled: boolean = $state(false)

	public aiChat: AiChat

	constructor(chat: Chat, user: AuthenticatedPrincipal, appConfig: AppConfig) {
		this.user = user
		this.APP_CONFIG = appConfig
		this.aiChat = new AiChat({
			transport: new DefaultChatTransport({
				api: "/api/chat",
				body: () => {
					const webSearchTools: ChatConfig["tools"] = this.webSearchEnabled
						? [{ type: "web_search" }, ...(this.chatConfig.tools?.filter((t) => t.type !== "web_search") ?? [])]
						: this.chatConfig.tools?.filter((t) => t.type !== "web_search")
					return {
						config: {
							...this.chatConfig,
							name: this.chatConfig.name || "Ukjent navn",
							tools: webSearchTools
						},
						stream: this.streamResponse,
						store: this.storeChat
					}
				}
			})
		})
		this.changeChat(chat)
	}

	public get isLoading(): boolean {
		return this.aiChat.status === "submitted" || this.aiChat.status === "streaming"
	}

	public get chat(): Chat {
		return {
			_id: this.chatId,
			config: this.chatConfig,
			createdAt: this.chatCreatedAt,
			updatedAt: this.chatUpdatedAt,
			owner: this.chatOwner
		}
	}

	public set chat(value: Chat) {
		this.chatId = value._id
		this.chatConfig = value.config
		this.chatCreatedAt = value.createdAt
		this.chatUpdatedAt = value.updatedAt
		this.chatOwner = value.owner
	}

	public changeChat = (chat: Chat): void => {
		if (!chat) {
			throw new Error("ChatState requires a Chat object")
		}
		this.chatId = chat._id
		this.chatConfig = chat.config
		this.chatCreatedAt = chat.createdAt
		this.chatUpdatedAt = chat.updatedAt
		this.chatOwner = chat.owner
		this.initialConfig = JSON.parse(JSON.stringify(chat.config))
		this.webSearchEnabled = false
		this.aiChat.messages = []
	}

	public newChat = (): void => {
		this.chatId = ""
		this.chatConfig = placeHolderConfig
		this.initialConfig = placeHolderConfig
		this.chatCreatedAt = new Date().toISOString()
		this.chatUpdatedAt = new Date().toISOString()
		this.webSearchEnabled = false
		this.aiChat.messages = []
	}

	public promptChat = async (inputText: string, inputFiles: FileList) => {
		const fileParts: FileUIPart[] = []

		if (inputFiles && inputFiles.length > 0) {
			const vendor = this.APP_CONFIG.VENDORS[this.chatConfig.vendorId]
			if (!vendor) {
				throw new Error(`Vendor not found: ${this.chatConfig.vendorId}`)
			}
			const supportedMimeTypes = [...vendor.SUPPORTED_MESSAGE_FILE_MIME_TYPES, ...vendor.SUPPORTED_MESSAGE_IMAGE_MIME_TYPES]

			for (const file of Array.from(inputFiles)) {
				if (!supportedMimeTypes.includes(file.type)) {
					throw new Error(`File type ${file.type} is not supported for vendor: ${this.chatConfig.vendorId}`)
				}
				const base64Url = await fileToBase64Url(file)
				fileParts.push({ type: "file", mediaType: file.type, filename: file.name, url: base64Url })
			}
		}

		if (fileParts.length > 0) {
			await this.aiChat.sendMessage({ text: inputText, files: fileParts })
		} else {
			await this.aiChat.sendMessage({ text: inputText })
		}
	}

	public saveChatConfig = async (): Promise<void> => {
		try {
			const result = await fetch(`/api/chatconfigs`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(this.chatConfig)
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
			const result = await fetch(`/api/chatconfigs/${this.chatConfig._id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(this.chatConfig)
			})
			if (!result.ok) {
				const errorData = await result.json()
				throw new Error(`Failed to update chat config: ${result.status} ${result.statusText} - ${errorData.message || JSON.stringify(errorData)}`)
			}
			const updatedConfig: ChatConfig = await result.json()
			this.chatConfig = updatedConfig
			this.initialConfig = JSON.parse(JSON.stringify(updatedConfig))
			this.configMode = false
			goto(`/agents/${this.chatConfig._id}`)
		} catch (error) {
			console.error("Error updating chat config:", error)
			throw error
		}
	}

	public deleteChatConfig = async (): Promise<void> => {
		const confirmDelete = confirm("Er du sikker på at du vil slette denne assistenten? Dette kan ikke angres. 😬")
		if (!confirmDelete) {
			return
		}
		try {
			const result = await fetch(`/api/chatconfigs/${this.chatConfig._id}`, { method: "DELETE" })
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
