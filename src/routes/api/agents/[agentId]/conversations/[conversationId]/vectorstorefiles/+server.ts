import { json, type RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent } from "$lib/server/agents/agents.js"
import { getConversation } from "$lib/server/agents/conversations"
import { responseStream } from "$lib/streaming.js"

export const GET: RequestHandler = async ({ params }) => {
	const { conversationId, agentId } = params
	if (!agentId || !conversationId) {
		return json({ error: "agentId and conversationId are required" }, { status: 400 })
	}

	const dbAgent = await getDBAgent(agentId)
	const conversation = await getConversation(conversationId)

	const agent = createAgent(dbAgent)

	const getConversationVectorStoreFilesResult = await agent.getConversationVectorStoreFiles(conversation)

	return json(getConversationVectorStoreFilesResult)
}

export const POST: RequestHandler = async ({ request, params }) => {
	// Da legger vi til en ny melding i samtalen i denne agenten via leverandør basert på agenten, og får tilbake responseStream med oppdatert samtalehistorikk
	const { conversationId, agentId } = params
	if (!agentId || !conversationId) {
		return json({ error: "agentId and conversationId are required" }, { status: 400 })
	}
	const body = await request.formData()
	const files: File[] = body.getAll("files[]") as File[]
	const streamParam = body.get("stream")
	if (!streamParam || (streamParam !== "true" && streamParam !== "false")) {
		return json({ error: 'stream parameter is required and must be either "true" or "false"' }, { status: 400 })
	}
	const stream: boolean = streamParam === "true"

	// Validate files
	if (!files || files.length === 0) {
		return json({ error: "No files provided for upload" }, { status: 400 })
	}
	const dbAgent = await getDBAgent(agentId)

	if (!dbAgent.config.fileSearchEnabled) {
		return json({ error: "File upload is not enabled for this agent" }, { status: 403 })
	}

	const conversation = await getConversation(conversationId)
	//	TODO: validate that conversation belongs to agentId and that user has access to it

	// Validate file types
	const allFilesValid = files.every((file) => {
		if (!(file instanceof File)) {
			return false
		}
		/* Må komme fra agent ellerno
    const validTypes = [];
    return validTypes.includes(file.type);
    */
		return true // For now, aksepter alle typer
	})
	if (!allFilesValid) {
		return json({ error: "One or more files have invalid type" }, { status: 400 }) // Add valid types message senere
	}

	const agent = createAgent(dbAgent)

	const { response } = await agent.addConversationVectorStoreFiles(conversation, files, stream)

	if (stream) {
		return responseStream(response)
	}
	throw new Error("Non-streaming file upload not implemented yet")
}
