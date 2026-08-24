import { HTTPError } from "../server/middleware/http-error"

const MAX_DIAGRAM_CHARS = 10 * 1024 * 1024

export type MermaidRequest = {
	diagram: string
	prompt: string
}

export const parseMermaidRequest = (input: unknown): MermaidRequest => {
	if (!input || typeof input !== "object") {
		throw new HTTPError(400, "Invalid request body")
	}
	const body = input as Record<string, unknown>

	if (body.diagram !== undefined && typeof body.diagram !== "string") {
		throw new HTTPError(400, "diagram must be a string")
	}
	const diagram = typeof body.diagram === "string" ? body.diagram : ""
	if (diagram.length > MAX_DIAGRAM_CHARS) {
		throw new HTTPError(400, "Diagram is too large")
	}
	if (typeof body.prompt !== "string" || body.prompt.trim() === "") {
		throw new HTTPError(400, "prompt must be a non-empty string")
	}

	return {
		diagram,
		prompt: body.prompt
	}
}
