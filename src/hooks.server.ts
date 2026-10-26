import { type Handle, json } from "@sveltejs/kit"
import { env } from "$env/dynamic/private"

// Cross-site request forgery: SvelteKit's own csrf.checkOrigin only blocks *form* content types, so a
// cross-site fetch(..., { mode: "no-cors", credentials: "include", body: <Blob without a type> }) from
// any other site still reached our JSON APIs with the visitor's login cookie - letting e.g. a
// student's page make a logged-in teacher's browser create or share assistants. Browsers always send
// Origin on such requests, so anything state-changing under /api/ must come from our own origin. No
// Origin at all means it isn't a browser on another site (a script with its own credentials, or a
// server-to-server callback such as /api/transcription/callback) - not CSRF, so not blocked here.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

// Clickjacking: nothing but the embeds may be framed by other sites. /public/embed/** is meant for
// any site; /embed/** (the logged-in widget) goes on internal pages - EMBED_FRAME_ANCESTORS (CSP
// source list, e.g. "https://telemarkfylke.sharepoint.com") narrows it once those are known.
const EMBED_FRAME_ANCESTORS = env.EMBED_FRAME_ANCESTORS?.trim() || "*"

const frameAncestorsFor = (pathname: string): string => {
	if (pathname.startsWith("/public/embed/")) return "*"
	if (pathname.startsWith("/embed/")) return EMBED_FRAME_ANCESTORS
	return "'self'"
}

export const handle: Handle = async ({ event, resolve }) => {
	const { request, url } = event
	if (url.pathname.startsWith("/api/") && !SAFE_METHODS.has(request.method)) {
		const origin = request.headers.get("origin")
		if (origin !== null && origin !== url.origin) {
			return json({ message: "Cross-site requests are forbidden" }, { status: 403 })
		}
	}

	const response = await resolve(event)
	const csp = `frame-ancestors ${frameAncestorsFor(url.pathname)}`
	try {
		response.headers.set("Content-Security-Policy", csp)
		return response
	} catch {
		// A Response passed straight through from fetch() has immutable headers - copy it to add ours
		const copy = new Response(response.body, response)
		copy.headers.set("Content-Security-Policy", csp)
		return copy
	}
}
