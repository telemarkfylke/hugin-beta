import { HTTPError } from "../server/middleware/http-error"
import type { CanvasRequest } from "../types/canvas"

const MAX_DOCUMENT_CHARS = 10 * 1024 * 1024

export const parseCanvasRequest = (input: unknown): CanvasRequest => {
	if (!input || typeof input !== "object") {
		throw new HTTPError(400, "Invalid request body")
	}
	const body = input as Record<string, unknown>

	if (typeof body.document !== "string") {
		throw new HTTPError(400, "document must be a string")
	}
	if (body.document.length > MAX_DOCUMENT_CHARS) {
		throw new HTTPError(400, "Document is too large")
	}
	if (typeof body.prompt !== "string" || body.prompt.trim() === "") {
		throw new HTTPError(400, "prompt must be a non-empty string")
	}
	if (body.webSearch !== undefined && typeof body.webSearch !== "boolean") {
		throw new HTTPError(400, "webSearch must be a boolean")
	}

	const result: CanvasRequest = {
		document: body.document,
		prompt: body.prompt
	}
	if (typeof body.webSearch === "boolean") result.webSearch = body.webSearch
	return result
}
