import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { canUseCanvas } from "$lib/authorization"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parsePresentationRequest } from "$lib/validation/parse-presentation-request"
import { extractTextOutput } from "../mermaid/extract-text-output"

const PRESENTATION_VENDOR_ID = "OPENAI" as const
const PRESENTATION_MODEL = "gpt-5.6-terra"

const PRESENTATION_SYSTEM_PROMPT = `You are a presentation editor. The user will give you the current presentation content (may be empty) and a prompt describing what to create or change.
The presentation is plain Markdown where each slide is separated by a line containing only "---".
Apply the requested changes and return ONLY the full updated Markdown document — no explanations, no preamble, no code fences around the whole document.
Preserve all slides the prompt does not ask you to change. When creating a new presentation from scratch, produce a reasonable set of slides with clear headings and concise bullet points.`

const presentationHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!APP_CONFIG.CANVAS_ENABLED) {
		throw new HTTPError(404, "Canvas is not enabled")
	}
	if (!canUseCanvas(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use Canvas")
	}
	if (!APP_CONFIG.VENDORS.OPENAI.ENABLED) {
		throw new HTTPError(503, "Presentation generation is not available — OpenAI vendor is not configured")
	}

	const body = await requestEvent.request.json()
	const { slides, prompt } = parsePresentationRequest(body)

	logger.info("[Canvas Presentation] User {userId} submitting prompt (slidesLength: {slidesLength})", user.userId, slides.length)

	const userMessage = slides ? `Here is the current presentation Markdown:\n\n${slides}\n\n---\n\nUser instruction: ${prompt}` : prompt

	const vendor = getVendor(PRESENTATION_VENDOR_ID)
	const response = await vendor.createChatResponse({
		config: {
			_id: "",
			name: "Canvas Presentation",
			description: "",
			vendorId: PRESENTATION_VENDOR_ID,
			project: "DEFAULT",
			model: PRESENTATION_MODEL,
			accessGroups: ["all"],
			type: "private",
			created: { at: "", by: { id: "" } },
			updated: { at: "", by: { id: "" } },
			instructions: PRESENTATION_SYSTEM_PROMPT
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
		throw new HTTPError(502, "Fikk ikke gyldig presentasjonsinnhold fra modellen")
	}

	return { isAuthorized: true, response: json({ slides: text }) }
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, presentationHandler)
}