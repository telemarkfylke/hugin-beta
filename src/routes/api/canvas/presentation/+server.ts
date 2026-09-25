import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { canUseCanvas } from "$lib/authorization"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { getDefaultModel } from "$lib/server/models/model-registry"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parsePresentationRequest } from "$lib/validation/parse-presentation-request"
import { extractTextOutput } from "../extract-text-output"

const PRESENTATION_SYSTEM_PROMPT = `You are a presentation editor. The user will give you the current presentation content (may be empty) and a prompt describing what to create or change.
The presentation is plain Markdown where each slide is separated by a line containing only "---".
The first slide is the deck's title/cover slide: it must contain ONLY a single "#" heading line (the presentation's title) — no bullets, no body text, no second heading. The exported PowerPoint cover layout has no content area, so anything beyond that one heading on the first slide is silently dropped when downloaded.
Every slide after the first should start with a single "#" or "##" heading line naming the slide, followed by "-" or "*" bullet lines for its content.
Apply the requested changes and return ONLY the full updated Markdown document — no explanations, no preamble, no code fences around the whole document.
Preserve all slides the prompt does not ask you to change. When creating a new presentation from scratch, give the first slide a title-only cover heading as described above, then produce the remaining slides with clear headings and concise bullet points.`

const presentationHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!APP_CONFIG.CANVAS_ENABLED) {
		throw new HTTPError(404, "Canvas is not enabled")
	}
	if (!canUseCanvas(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use Canvas")
	}
	const canvasModel = getDefaultModel("canvas")
	if (!canvasModel) {
		throw new HTTPError(503, "Presentation generation is not available — the canvas model's vendor is not configured")
	}

	const body = await requestEvent.request.json()
	const { slides, prompt, webSearch, document } = parsePresentationRequest(body)

	logger.info(
		"[Canvas Presentation] User {userId} submitting prompt (slidesLength: {slidesLength}), webSearch: {webSearch}, document: {hasDocument}",
		user.userId,
		slides.length,
		webSearch ?? false,
		!!document
	)

	const userMessage = slides ? `Here is the current presentation Markdown:\n\n${slides}\n\n---\n\nUser instruction: ${prompt}` : prompt

	const vendor = getVendor(canvasModel.vendorId)
	const response = await vendor.createChatResponse({
		config: {
			_id: "",
			name: "Canvas Presentation",
			description: "",
			vendorId: canvasModel.vendorId,
			project: canvasModel.project,
			model: canvasModel.model,
			accessGroups: ["all"],
			type: "private",
			created: { at: "", by: { id: "" } },
			updated: { at: "", by: { id: "" } },
			instructions: PRESENTATION_SYSTEM_PROMPT,
			tools: webSearch ? [{ type: "web_search" as const }] : undefined
		},
		inputs: [
			{
				type: "message.input",
				role: "user",
				content: [{ type: "input_text", text: userMessage }, ...(document ? [{ type: "input_file" as const, fileName: document.fileName, fileUrl: document.fileUrl }] : [])]
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
