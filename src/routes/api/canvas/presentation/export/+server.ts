import type { RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { canUseCanvas } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { buildPresentation } from "$lib/server/canvas/presentation/build-presentation"
import { parseSlidesForExport } from "$lib/server/canvas/presentation/parse-slides-for-export"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parsePresentationExportRequest } from "$lib/validation/parse-presentation-export-request"

const exportHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!APP_CONFIG.CANVAS_ENABLED) {
		throw new HTTPError(404, "Canvas is not enabled")
	}
	if (!canUseCanvas(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use Canvas")
	}

	const body = await requestEvent.request.json()
	const { slides } = parsePresentationExportRequest(body)
	const parsedSlides = parseSlidesForExport(slides)

	if (parsedSlides.length === 0) {
		throw new HTTPError(400, "Ingen lysbilder å eksportere")
	}

	logger.info("[Canvas Presentation] User {userId} exporting presentation (slideCount: {slideCount})", user.userId, parsedSlides.length)

	let pptxBuffer: Buffer
	try {
		pptxBuffer = await buildPresentation(parsedSlides)
	} catch (error) {
		logger.errorException(error, "[Canvas Presentation] Failed to build PPTX for user {userId}", user.userId)
		throw new HTTPError(500, "Kunne ikke generere PPTX-fil")
	}

	return {
		isAuthorized: true,
		// Buffer is a Uint8Array subclass, but its type declarations in the current @types/node
		// (25.x) generic-parameterize it in a way TS no longer accepts as BodyInit for Response —
		// wrapping in `new Uint8Array(...)` satisfies the type without copying/altering the bytes.
		response: new Response(new Uint8Array(pptxBuffer), {
			status: 200,
			headers: {
				"Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
				"Content-Disposition": 'attachment; filename="presentasjon.pptx"'
			}
		})
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, exportHandler)
}
