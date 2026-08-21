import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { canUseCanvas } from "$lib/authorization"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parseMermaidRequest } from "$lib/validation/parse-mermaid-request"
import { extractTextOutput } from "./extract-text-output"

const MERMAID_VENDOR_ID = "OPENAI" as const
const MERMAID_MODEL = "gpt-5.6-terra"

const MERMAID_SYSTEM_PROMPT = `You are a Mermaid diagram generator. The user will give you the current Mermaid diagram source (may be empty) and a prompt describing what to create or change.
Apply the requested changes and return ONLY valid Mermaid diagram syntax — no explanations, no preamble, no markdown code fences around the output.`

const mermaidHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!APP_CONFIG.CANVAS_ENABLED) {
		throw new HTTPError(404, "Canvas is not enabled")
	}
	if (!canUseCanvas(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use Canvas")
	}
	if (!APP_CONFIG.VENDORS.OPENAI.ENABLED) {
		throw new HTTPError(503, "Diagram is not available — OpenAI vendor is not configured")
	}

	const body = await requestEvent.request.json()
	const { diagram, prompt } = parseMermaidRequest(body)

	logger.info("[Canvas Mermaid] User {userId} submitting prompt (diagramLength: {diagramLength})", user.userId, diagram.length)

	const userMessage = diagram ? `Here is the current Mermaid diagram source:\n\n${diagram}\n\n---\n\nUser instruction: ${prompt}` : prompt

	const vendor = getVendor(MERMAID_VENDOR_ID)
	const response = await vendor.createChatResponse({
		config: {
			_id: "",
			name: "Canvas Mermaid",
			description: "",
			vendorId: MERMAID_VENDOR_ID,
			project: "DEFAULT",
			model: MERMAID_MODEL,
			accessGroups: ["all"],
			type: "private",
			created: { at: "", by: { id: "" } },
			updated: { at: "", by: { id: "" } },
			instructions: MERMAID_SYSTEM_PROMPT
		},
		inputs: [
			{
				type: "message.input",
				role: "user",
				content: [{ type: "input_text", text: userMessage }]
			}
		],
		stream: false
	})

	const text = extractTextOutput(response.outputs)

	if (!text.trim()) {
		throw new HTTPError(502, "Fikk ikke gyldig diagram fra modellen")
	}

	return { isAuthorized: true, response: json({ diagram: text }) }
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, mermaidHandler)
}
