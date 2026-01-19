import { json, type RequestHandler } from "@sveltejs/kit"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { responseStream } from "$lib/streaming"
import type { ChatConfig, ChatRequest } from "$lib/types/chat"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parseChatConfig } from "$lib/validation/parse-chat-config"
import { validateFileInputs } from "$lib/validation/file-input"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { logger } from "@vestfoldfylke/loglady"
import { canEditPredefinedConfig, canPromptPredefinedConfig } from "$lib/authorization"

const parseChatRequest = (body: unknown): ChatRequest => {
	if (typeof body !== "object" || body === null) {
		throw new HTTPError(400, "Invalid chat config")
	}
	const incomingChatRequest: ChatRequest = body as ChatRequest

	const config = parseChatConfig(incomingChatRequest.config, APP_CONFIG)

	if (!Array.isArray(incomingChatRequest.inputs) || incomingChatRequest.inputs.length === 0) {
		throw new HTTPError(400, "inputs must be a non-empty array")
	}
	if (config.vendorAgent) {
		return {
			config,
			inputs: incomingChatRequest.inputs,
			stream: Boolean(incomingChatRequest.stream)
		}
	}

	const manualChatRequest: ChatRequest = {
		config,
		inputs: incomingChatRequest.inputs,
		stream: Boolean(incomingChatRequest.stream)
	}

	validateFileInputs(manualChatRequest, APP_CONFIG)

	return manualChatRequest
}

const canPromptVendorAgentCache: { expires: number; accessCache: Map<string, boolean> } = {
	expires: Date.now() + 60 * 60 * 1000, // 60 minutes
	accessCache: new Map()
}

const canPromptVendorAgent = async (user: AuthenticatedPrincipal, chatConfig: ChatConfig): Promise<boolean> => {
	if (!chatConfig.vendorAgent) {
		throw new Error("canPromptVendorAgent called with chatConfig that is not a predefined config")
	}
	if (!chatConfig.vendorAgent.id) {
		throw new Error("canPromptVendorAgent called with chatConfig that has no vendorAgent.id")
	}
	if (canEditPredefinedConfig(user, APP_CONFIG.APP_ROLES)) {
		// Quick return if can edit predefined config
		return true
	}
	if (Date.now() > canPromptVendorAgentCache.expires) {
		canPromptVendorAgentCache.expires = Date.now() + 60 * 60 * 1000 // 60 minutes
		canPromptVendorAgentCache.accessCache.clear()
	}
	const cacheKey = `${user.userId}-${chatConfig.vendorId}-${chatConfig.vendorAgent?.id}`
	const cachedAccess = canPromptVendorAgentCache.accessCache.get(cacheKey)
	if (typeof cachedAccess === "boolean") {
		logger.debug(`canPromptVendorAgent cache hit for key ${cacheKey}: ${cachedAccess}. Quick return.`)
		return cachedAccess
	}
	const chatConfigStore = getChatConfigStore()
	const chatConfigsWithVendorAgentId = await chatConfigStore.getChatConfigsByVendorAgentId(chatConfig.vendorAgent.id)
	const canPrompt = canPromptPredefinedConfig(user, APP_CONFIG.APP_ROLES, chatConfig.vendorAgent.id, chatConfigsWithVendorAgentId)
	canPromptVendorAgentCache.accessCache.set(cacheKey, canPrompt)
	return canPrompt
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

	// If predefined config, check if user can use it
	if (chatRequest.config.vendorAgent) {
		const canPrompt = await canPromptVendorAgent(user, chatRequest.config)
		if (!canPrompt) {
			throw new HTTPError(403, "User is not authorized to use this predefined chat configuration")
		}
	}

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
