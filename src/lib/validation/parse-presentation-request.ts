import { HTTPError } from "../server/middleware/http-error"
import type { PresentationRequest } from "../types/canvas"

const MAX_SLIDES_CHARS = 10 * 1024 * 1024

export const parsePresentationRequest = (input: unknown): PresentationRequest => {
	if (!input || typeof input !== "object") {
		throw new HTTPError(400, "Invalid request body")
	}
	const body = input as Record<string, unknown>

	if (typeof body.slides !== "string") {
		throw new HTTPError(400, "slides must be a string")
	}
	if (body.slides.length > MAX_SLIDES_CHARS) {
		throw new HTTPError(400, "Slides content is too large")
	}
	if (typeof body.prompt !== "string" || body.prompt.trim() === "") {
		throw new HTTPError(400, "prompt must be a non-empty string")
	}

	return {
		slides: body.slides,
		prompt: body.prompt
	}
}
