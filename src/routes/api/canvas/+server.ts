import type { RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { canUseCanvas } from "$lib/authorization"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { responseStream } from "$lib/streaming"
import { CanvasRequestSchema } from "$lib/types/canvas"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const CANVAS_VENDOR_ID = "OPENAI" as const
const CANVAS_MODEL = "gpt-5.4"

const CANVAS_SYSTEM_PROMPT = `You are a document editor. The user will give you a document (in markdown) and a prompt describing what to change.
Apply the requested changes to the document and return ONLY the full updated markdown document — no explanations, no preamble, no code fences around the whole document.
Preserve all parts of the document that the prompt does not ask you to change.`

const canvasHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!APP_CONFIG.CANVAS_ENABLED) {
		throw new HTTPError(404, "Canvas is not enabled")
	}
	if (!canUseCanvas(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use Canvas")
	}

	const body = await requestEvent.request.json()
	const parseResult = CanvasRequestSchema.safeParse(body)
	if (!parseResult.success) {
		throw new HTTPError(400, parseResult.error.issues[0]?.message ?? "Invalid request body")
	}

	const { document, prompt, webSearch } = parseResult.data

	if (webSearch && !APP_CONFIG.VENDORS.OPENAI.ENABLED) {
		throw new HTTPError(400, "Web search is not available — OpenAI vendor is not configured")
	}

	logger.info(`[Canvas] User {userId} submitting prompt (webSearch: ${webSearch ?? false}, documentLength: ${document.length})`, user.userId)

	const userMessage = document ? `Here is the current document:\n\n${document}\n\n---\n\nUser instruction: ${prompt}` : prompt

	const vendor = getVendor(CANVAS_VENDOR_ID)
	const stream = await vendor.createChatResponseStream({
		config: {
			_id: "",
			name: "Canvas",
			description: "",
			vendorId: CANVAS_VENDOR_ID,
			project: "DEFAULT",
			model: CANVAS_MODEL,
			accessGroups: ["all"],
			type: "private",
			created: { at: "", by: { id: "" } },
			updated: { at: "", by: { id: "" } },
			instructions: CANVAS_SYSTEM_PROMPT,
			tools: webSearch ? [{ type: "web_search" as const }] : undefined
		},
		inputs: [
			{
				type: "message.input",
				role: "user",
				content: [{ type: "input_text", text: userMessage }]
			}
		],
		stream: true
	})

	return { isAuthorized: true, response: responseStream(stream) }
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, canvasHandler)
}
