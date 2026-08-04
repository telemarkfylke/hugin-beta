import { json, type RequestHandler } from "@sveltejs/kit"
import { canPromptConfig } from "$lib/authorization"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { MS_AUTH_TOKEN_HEADER } from "$lib/server/auth/auth-constants"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { searchRagStores } from "$lib/server/ragservice/rag-search"
import { responseStream } from "$lib/streaming"
import type { ChatRequest } from "$lib/types/chat"
import type { ChatInputMessage } from "$lib/types/chat-item"
import type { InputText } from "$lib/types/chat-item-content"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { validateFileInputs } from "$lib/validation/file-input"
import { parseChatConfig } from "$lib/validation/parse-chat-config"

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

const supahChat: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const body = await requestEvent.request.json()

	const chatRequest = parseChatRequest(body)

	if (!canPromptConfig(user, APP_CONFIG, chatRequest.config)) {
		throw new HTTPError(403, "Not authorized to use this chat configuration")
	}

	const datasourceToolActive = chatRequest.config.tools?.some((t) => t.type === "datasource") ?? false
	const ragStoreIds = datasourceToolActive ? (chatRequest.config.dataSources?.filter((s) => s.type === "ragservice").map((s) => s.id) ?? []) : []

	if (ragStoreIds.length > 0) {
		const lastUserMsg = [...chatRequest.inputs].reverse().find((i): i is ChatInputMessage => i.type === "message.input" && i.role === "user")

		const queryText =
			lastUserMsg?.content
				.filter((c): c is InputText => c.type === "input_text")
				.map((c) => c.text)
				.join(" ")
				.trim() ?? ""

		if (queryText) {
			const graphToken = requestEvent.request.headers.get(MS_AUTH_TOKEN_HEADER)
			const matches = await searchRagStores(ragStoreIds, queryText, user, graphToken)

			if (matches.length > 0) {
				const contextText = matches.map((m) => m.text).join("\n\n---\n\n")
				chatRequest.config.instructions = `${chatRequest.config.instructions ?? ""}\n\n#Relevant kontekst fra datakilder:\n\n${contextText}`
			}
		}
	}

	// Strip internal Hugin tools that vendors don't know about
	chatRequest.config.tools = chatRequest.config.tools?.filter((t) => t.type !== "datasource")

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
