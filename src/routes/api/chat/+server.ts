import { json, type RequestHandler } from "@sveltejs/kit"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { responseStream } from "$lib/streaming"
import type { ChatConfig, ChatRequest } from "$lib/types/chat"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const validFileType = (fileUrl: string, supportedMimeTypes: string[]): boolean => {
	const mimeType = fileUrl.substring(fileUrl.indexOf(":") + 1, fileUrl.indexOf(";base64")) // data:<mime-type>;base64,<data>
	return supportedMimeTypes.includes(mimeType)
}

const validateFileInputs = (chatRequest: ChatRequest) => {
	const lastMessage = chatRequest.inputs[chatRequest.inputs.length - 1]
	if (!lastMessage || lastMessage.type !== "message.input") {
		throw new HTTPError(400, "Last input must be a message.input to validate file inputs")
	}

	const vendor = Object.values(APP_CONFIG.VENDORS).find((vendor) => vendor.ID === chatRequest.config.vendorId && vendor.ENABLED)
	if (!vendor) {
		throw new HTTPError(400, `Unsupported vendorId: ${chatRequest.config.vendorId}`)
	}

	const modelSupportedMimeTypes = vendor.MODELS.find((model) => model.ID === chatRequest.config.model)?.SUPPORTED_MESSAGE_FILE_MIME_TYPES || {
		FILE: [],
		IMAGE: []
	}

	const supportedMimeTypes = [...modelSupportedMimeTypes.FILE, ...modelSupportedMimeTypes.IMAGE]

	const fileInputs = lastMessage.content.filter((contentItem) => contentItem.type === "input_file" || contentItem.type === "input_image")
	for (const fileInput of fileInputs.slice(-1)) {
		if (!validFileType(fileInput.type === "input_file" ? fileInput.fileUrl : fileInput.imageUrl, supportedMimeTypes)) {
			throw new HTTPError(400, `File type of uploaded file is not supported for vendor/model: ${chatRequest.config.vendorId}-${chatRequest.config.model}`)
		}
	}

	// Filter out all previous file inputs of not valid mimetype (in case someone changed model/vendor mid-conversation)
	for (const [index, inputItem] of chatRequest.inputs.entries()) {
		if (index === chatRequest.inputs.length - 1) {
			continue // Skip last message, already validated
		}
		if (inputItem.type !== "message.input") {
			continue
		}
		inputItem.content = inputItem.content.filter((contentItem) => {
			if (contentItem.type === "input_file") {
				return validFileType(contentItem.fileUrl, supportedMimeTypes)
			}
			if (contentItem.type === "input_image") {
				return validFileType(contentItem.imageUrl, supportedMimeTypes)
			}
			return true
		})
	}
}

const parseChatRequest = (body: unknown): ChatRequest => {
	if (typeof body !== "object" || body === null) {
		throw new HTTPError(400, "Invalid chat config")
	}
	const incomingChatRequest: ChatRequest = body as ChatRequest

	const config = incomingChatRequest.config

	if (!config || typeof config !== "object") {
		throw new HTTPError(400, "config is required and must be an object")
	}

	if (typeof config._id !== "string") {
		throw new HTTPError(400, "config._id must be a string")
	}
	if (typeof config.name !== "string") {
		throw new HTTPError(400, "config.name must be a string")
	}
	if (typeof config.description !== "string") {
		throw new HTTPError(400, "config.description must be a string")
	}

	if (!config.vendorId || typeof config.vendorId !== "string") {
		throw new HTTPError(400, "vendorId is required and must be a string")
	}
	const VENDOR = Object.values(APP_CONFIG.VENDORS).find((vendor) => vendor.ID === config.vendorId && vendor.ENABLED)
	if (!VENDOR) {
		throw new HTTPError(400, `Unsupported vendorId: ${config.vendorId}`)
	}
	if (!VENDOR.PROJECTS.includes(config.project)) {
		throw new HTTPError(400, `Unsupported project: ${config.project} for vendorId: ${config.vendorId}`)
	}
	if (!incomingChatRequest.inputs || !Array.isArray(incomingChatRequest.inputs)) {
		throw new HTTPError(400, "inputs is required and must be an array")
	}
	if (config.vendorAgent) {
		// Predefined config
		if (typeof config.vendorAgent.id !== "string") {
			throw new HTTPError(400, "vendorAgent.id must be a string")
		}
		if (incomingChatRequest.stream !== undefined) {
			if (typeof incomingChatRequest.stream !== "boolean") {
				throw new HTTPError(400, "stream must be a boolean")
			}
		}
		return {
			config: {
				_id: config._id,
				name: config.name,
				description: config.description,
				vendorId: config.vendorId,
				project: config.project,
				vendorAgent: {
					id: config.vendorAgent.id
				}
			},
			inputs: incomingChatRequest.inputs,
			stream: Boolean(incomingChatRequest.stream)
		}
	}
	// Manual config
	if (!config.model || typeof config.model !== "string") {
		throw new HTTPError(400, "model is required and must be a string")
	}
	const manualChatConfig: ChatConfig = {
		_id: config._id,
		name: config.name,
		description: config.description,
		vendorId: config.vendorId,
		project: config.project,
		model: config.model
	}
	if (config.instructions) {
		if (typeof config.instructions !== "string") {
			throw new HTTPError(400, "instructions must be a string")
		}
		manualChatConfig.instructions = config.instructions
	}
	if (config.conversationId) {
		if (typeof config.conversationId !== "string") {
			throw new HTTPError(400, "conversationId must be a string")
		}
		manualChatConfig.conversationId = config.conversationId
	}
	if (incomingChatRequest.stream !== undefined) {
		if (typeof incomingChatRequest.stream !== "boolean") {
			throw new HTTPError(400, "stream must be a boolean")
		}
	}
	if (config.tools) {
		if (!Array.isArray(config.tools)) {
			throw new HTTPError(400, "tools must be an array of tools")
		}
		manualChatConfig.tools = config.tools
	}

	const manualChatRequest: ChatRequest = {
		config: manualChatConfig,
		inputs: incomingChatRequest.inputs,
		stream: Boolean(incomingChatRequest.stream)
	}

	validateFileInputs(manualChatRequest)

	return manualChatRequest
}

const supahChat: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const body = await requestEvent.request.json()

	const chatRequest = parseChatRequest(body)

	const vendor = getVendor(chatRequest.config.vendorId)

	if (chatRequest.stream) {
		const stream = await vendor.createChatResponseStream(chatRequest)

		// Så kan vi sikkert lage en kopi av streamen for å lagre i db eller noe også her (hvis det er en conversatonId eller noe sånt og store ikke er false)
		return {
			isAuthorized: true,
			response: responseStream(stream)
		}
	}

	const response = await vendor.createChatResponse(chatRequest)

	// Save to db and check stuff or whatever here

	return {
		isAuthorized: true,
		response: json(response)
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, supahChat)
}
