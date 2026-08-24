import { error, type RequestHandler } from "@sveltejs/kit"
import { env } from "$env/dynamic/private"
import { canUseRagservice } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { MS_AUTH_TOKEN_HEADER } from "$lib/server/auth/auth-constants"
import { getAuthenticatedPrincipal } from "$lib/server/auth/get-authenticated-user"
import { getUserGroups } from "$lib/server/auth/get-user-groups"
import { getRagToken } from "$lib/server/ragservice/get-rag-token"

async function proxyToRag(request: Request, path: string, url: URL): Promise<Response> {
	let ragToken: string
	let groups: string[]

	let principal: ReturnType<typeof getAuthenticatedPrincipal>
	try {
		principal = getAuthenticatedPrincipal(request.headers)
	} catch {
		error(401, "Ikke autentisert")
	}
	const userId = principal.userId

	// Admin-only while the ragservice GUI still needs a deeper review - not just for existing
	// libraries (those are already gated per-store via AccessRow), but anyone let through here
	// could otherwise create their own libraries too, which nothing else here would stop.
	if (!canUseRagservice(principal, APP_CONFIG.APP_ROLES)) {
		error(403, "Ikke tilgang til datakilder")
	}

	if (env.MOCK_AUTH === "true") {
		if (!env.RAGSERVICE_TOKEN) error(500, "RAGSERVICE_TOKEN er ikke satt i .env for lokal utvikling")
		ragToken = env.RAGSERVICE_TOKEN
		groups = principal.groups
	} else {
		const graphToken = request.headers.get(MS_AUTH_TOKEN_HEADER)
		groups = await getUserGroups(principal, graphToken)
		try {
			ragToken = await getRagToken()
		} catch {
			error(500, "Kunne ikke hente tilgangstoken for datakilde")
		}
	}

	const ragUrl = `${env.RAGSERVICE_URL}/api/${path}${url.search}`

	const headers: Record<string, string> = {
		authorization: `Bearer ${ragToken}`,
		"x-user-id": userId,
		"x-user-groups": groups.join(",")
	}
	const contentType = request.headers.get("content-type")
	if (contentType) headers["content-type"] = contentType

	const isBodyless = ["GET", "HEAD"].includes(request.method)

	const fetchOptions: RequestInit = { method: request.method, headers, redirect: "manual" }
	if (!isBodyless) {
		fetchOptions.body = request.body
		// @ts-expect-error — required in Node 18+ to stream request bodies
		fetchOptions.duplex = "half"
	}

	let upstream = await fetch(ragUrl, fetchOptions)

	if (upstream.status >= 300 && upstream.status < 400) {
		const location = upstream.headers.get("location")
		if (location) upstream = await fetch(location, { method: request.method, headers })
	}

	return new Response(upstream.body, {
		status: upstream.status,
		headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" }
	})
}

const handler: RequestHandler = ({ request, params, url }) => proxyToRag(request, params.path ?? "", url)

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
