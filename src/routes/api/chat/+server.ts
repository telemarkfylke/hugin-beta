import type { RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { convertToModelMessages, streamText } from "ai"
import { canPromptConfig } from "$lib/authorization"
import { resolveModel } from "$lib/server/ai-sdk/resolve-model"
import { resolveTools } from "$lib/server/ai-sdk/resolve-tools"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parseChatConfig } from "$lib/validation/parse-chat-config"

const chatHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const body = await requestEvent.request.json()

	if (typeof body !== "object" || body === null) {
		throw new HTTPError(400, "Invalid request body")
	}

	const { messages, config: rawConfig } = body as { messages: unknown; config: unknown }

	if (!Array.isArray(messages) || messages.length === 0) {
		throw new HTTPError(400, "messages must be a non-empty array")
	}

	const config = parseChatConfig(rawConfig, APP_CONFIG)

	if (!canPromptConfig(user, APP_CONFIG, config)) {
		throw new HTTPError(403, "Not authorized to use this chat configuration")
	}

	logger.info("AI SDK chat request for config {configId} by {userId}", config._id, user.userId)

	const model = resolveModel(config)
	const coreMessages = await convertToModelMessages(messages)
	const tools = resolveTools(config.tools, config)

	const result = streamText({
		model,
		messages: coreMessages,
		...(config.instructions ? { system: config.instructions } : {}),
		...(tools ? { tools } : {}),
		...(config.providerOptions ? { providerOptions: config.providerOptions } : {})
	})

	return {
		isAuthorized: true,
		response: result.toUIMessageStreamResponse()
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, chatHandler)
}
