import { json, type RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent } from "$lib/server/agents/agents.js"
import { getDBConversation } from "$lib/server/agents/conversations"
import { canPromptAgent, canViewConversation } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware, type MiddlewareNextFunction } from "$lib/server/middleware/http-request"
import { responseStream } from "$lib/streaming.js"
import type { Agent } from "$lib/types/agents"

const getVectorStoreFiles: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent.params.agentId || !requestEvent.params.conversationId) {
		throw new HTTPError(400, "agentId and conversationId are required")
	}
	const dbAgent = await getDBAgent(requestEvent.params.agentId)
	if (!canPromptAgent(user, dbAgent)) {
		return {
			response: new Response("Forbidden", { status: 403 }),
			isAuthorized: false
		}
	}
	const conversation = await getDBConversation(requestEvent.params.conversationId)
	if (!canViewConversation(user, conversation)) {
		return {
			response: new Response("Forbidden", { status: 403 }),
			isAuthorized: false
		}
	}
	const agent = createAgent(dbAgent)
	const getConversationVectorStoreFilesResult = await agent.getConversationVectorStoreFiles(conversation)

	return {
		response: json(getConversationVectorStoreFilesResult),
		isAuthorized: true
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getVectorStoreFiles)
}

const uploadVectorStoreFiles: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent.params.agentId || !requestEvent.params.conversationId) {
		throw new HTTPError(400, "agentId and conversationId are required")
	}
	const dbAgent = await getDBAgent(requestEvent.params.agentId)
	if (!canPromptAgent(user, dbAgent)) {
		return {
			response: new Response("Forbidden", { status: 403 }),
			isAuthorized: false
		}
	}
	const conversation = await getDBConversation(requestEvent.params.conversationId)
	if (!canViewConversation(user, conversation)) {
		return {
			response: new Response("Forbidden", { status: 403 }),
			isAuthorized: false
		}
	}

	if (!dbAgent.config.vectorStoreEnabled) {
		throw new HTTPError(403, "File upload is not enabled for this agent")
	}

	const body = await requestEvent.request.formData()
	const files: File[] = body.getAll("files[]") as File[]
	const streamParam = body.get("stream")
	if (!streamParam || (streamParam !== "true" && streamParam !== "false")) {
		throw new HTTPError(400, 'stream parameter is required and must be either "true" or "false"')
	}
	const stream: boolean = streamParam === "true"

	// Validate files
	if (!files || files.length === 0) {
		throw new HTTPError(400, "No files provided for upload")
	}

	const agent = createAgent(dbAgent)
	const agentInfo: Agent = agent.getAgentInfo()
	// Validate each file
	if (!files.every((file) => file instanceof File)) {
		throw new HTTPError(400, "One or more files are not valid File instances")
	}
	if (!files.every((file) => file.type)) {
		throw new HTTPError(400, "One or more files have empty file type")
	}
	if (!files.every((file) => agentInfo.allowedMimeTypes.vectorStoreFiles.includes(file.type))) {
		throw new HTTPError(400, "One or more files have invalid file type") // Add valid types message senere
	}

	const { response } = await agent.addConversationVectorStoreFiles(conversation, files, stream)

	if (stream) {
		return {
			response: responseStream(response),
			isAuthorized: true
		}
	}
	throw new Error("Non-streaming file upload not implemented yet")
}

export const POST: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, uploadVectorStoreFiles)
}

// TODO, fortsett med resten av endepunktene MIDDLEWARE
