import type { PresentationExportRequest } from "../types/canvas"
import { HTTPError } from "../server/middleware/http-error"

const MAX_SLIDES_CHARS = 10 * 1024 * 1024

export const parsePresentationExportRequest = (input: unknown): PresentationExportRequest => {
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

	return { slides: body.slides }
}
