import type { Handle } from "@sveltejs/kit"
import { env } from "$env/dynamic/private"
import maintenanceHtml from "./maintenance.html?raw"

// Must match the <img src> in maintenance.html - the only request let through while in maintenance mode.
const MAINTENANCE_IMAGE_PATH = "/public/vedlikehold.avif"

const MAINTENANCE_HEADERS = { "Cache-Control": "no-store", "Retry-After": "600" }

// MAINTENANCE=true replaces the whole app with a single image. Read per request so flipping it in App Service config
// only needs the restart it triggers - no deploy.
const isMaintenanceMode = (): boolean => env.MAINTENANCE?.trim().toLowerCase() === "true"

const isApiPath = (pathname: string): boolean => pathname.startsWith("/api/") || pathname.startsWith("/public/embed/api/")

export const maintenance: Handle = async ({ event, resolve }) => {
	if (!isMaintenanceMode() || event.url.pathname === MAINTENANCE_IMAGE_PATH) {
		return resolve(event)
	}

	if (isApiPath(event.url.pathname)) {
		return new Response(JSON.stringify({ message: "Service unavailable - maintenance" }), {
			status: 503,
			headers: { ...MAINTENANCE_HEADERS, "Content-Type": "application/json" }
		})
	}

	return new Response(maintenanceHtml, {
		status: 503,
		headers: { ...MAINTENANCE_HEADERS, "Content-Type": "text/html; charset=utf-8" }
	})
}
