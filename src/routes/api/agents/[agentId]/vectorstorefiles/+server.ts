/*
import { json, type RequestHandler } from "@sveltejs/kit"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"
import { createAgent, getDBAgent } from "$lib/server/agents/agents.js"
import { canPromptAgent } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { Agent } from "$lib/types/agents"
import { responseStream } from "$lib/streaming"

const uploadDataFiles: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent.params.agentId) {
		throw new HTTPError(400, "agentId are required")
	}
	const dbAgent = await getDBAgent(requestEvent.params.agentId)
	if (!canPromptAgent(user, dbAgent)) {
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

	const { response } = await agent.appendVectorStoreFiles(files, stream)

	if (stream) {
		return {
			response: responseStream(response),
			isAuthorized: true
		}
	}
	throw new Error("Non-streaming file upload not implemented yet")
}


export const POST: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, uploadDataFiles)
}
*/
