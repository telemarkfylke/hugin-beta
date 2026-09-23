import { HTTPError } from "../server/middleware/http-error"
import type { PresentationRequest } from "../types/canvas"

const MAX_SLIDES_CHARS = 10 * 1024 * 1024
const MAX_DOCUMENT_CHARS = 15 * 1024 * 1024

export const parsePresentationRequest = (input: unknown): PresentationRequest => {
	if (!input || typeof input !== "object") {
		throw new HTTPError(400, "Invalid request body")
	}
	const body = input as Record<string, unknown>

	if (body.slides !== undefined && typeof body.slides !== "string") {
		throw new HTTPError(400, "slides must be a string")
	}
	const slides = typeof body.slides === "string" ? body.slides : ""
	if (slides.length > MAX_SLIDES_CHARS) {
		throw new HTTPError(400, "Slides content is too large")
	}
	if (typeof body.prompt !== "string" || body.prompt.trim() === "") {
		throw new HTTPError(400, "prompt must be a non-empty string")
	}
	if (body.webSearch !== undefined && typeof body.webSearch !== "boolean") {
		throw new HTTPError(400, "webSearch must be a boolean")
	}

	let document: PresentationRequest["document"]
	if (body.document !== undefined) {
		if (!body.document || typeof body.document !== "object") {
			throw new HTTPError(400, "document must be an object")
		}
		const documentBody = body.document as Record<string, unknown>
		if (typeof documentBody.fileName !== "string" || documentBody.fileName.trim() === "") {
			throw new HTTPError(400, "document.fileName must be a non-empty string")
		}
		if (typeof documentBody.fileUrl !== "string" || !documentBody.fileUrl.startsWith("data:application/pdf")) {
			throw new HTTPError(400, "document.fileUrl must be a base64 PDF data URL")
		}
		if (documentBody.fileUrl.length > MAX_DOCUMENT_CHARS) {
			throw new HTTPError(400, "Document is too large")
		}
		document = { fileName: documentBody.fileName, fileUrl: documentBody.fileUrl }
	}

	const result: PresentationRequest = {
		slides,
		prompt: body.prompt
	}
	if (typeof body.webSearch === "boolean") result.webSearch = body.webSearch
	if (document) result.document = document
	return result
}
