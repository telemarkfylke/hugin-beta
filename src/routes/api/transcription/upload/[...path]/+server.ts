import { env } from "$env/dynamic/private"
import type { RequestHandler } from "@sveltejs/kit"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const proxyUpload: ApiNextFunction = async ({ requestEvent, user }) => {
	const copypartyBase = env.COPYPARTY_BASE_URL
	if (!copypartyBase) {
		throw new HTTPError(500, "COPYPARTY_BASE_URL is not configured")
	}

	const { request } = requestEvent

	// Extract the two expected segments: <userId>/<filename>
	const suffix = requestEvent.params.path ?? ""
	const slashIdx = suffix.indexOf("/")
	if (slashIdx === -1) {
		throw new HTTPError(400, "Invalid upload path — expected /<userId>/<filename>")
	}

	// Validate userId from URL against the authenticated user — prevents writing to other users' folders
	const userIdFromUrl = decodeURIComponent(suffix.slice(0, slashIdx))
	if (userIdFromUrl !== user.userId) {
		throw new HTTPError(403, "Upload path does not match authenticated user")
	}

	// Decode and sanitize the filename — reject path traversal attempts (%2F, %5C, ..)
	const rawFileName = suffix.slice(slashIdx + 1)
	const decodedFileName = decodeURIComponent(rawFileName)
	if (decodedFileName.includes("/") || decodedFileName.includes("\\") || decodedFileName.includes("..")) {
		throw new HTTPError(400, "Invalid filename")
	}

	// Reconstruct the target URL from trusted data only (userId from auth, sanitized filename)
	const targetUrl = `${copypartyBase}/${encodeURIComponent(user.userId)}/${encodeURIComponent(decodedFileName)}`

	// Forward Content-Length if present so Copyparty gets the size upfront (avoids chunked encoding)
	const headers: Record<string, string> = { "Content-Type": "application/octet-stream" }
	const contentLength = request.headers.get("content-length")
	if (contentLength) headers["content-length"] = contentLength

	const upstream = await fetch(targetUrl, {
		method: "PUT",
		body: request.body,
		headers,
		// @ts-expect-error — required in Node 18+ to stream request bodies
		duplex: "half"
	})

	return {
		isAuthorized: true,
		response: new Response(upstream.body, { status: upstream.status })
	}
}

export const PUT: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, proxyUpload)
