import { redirect } from "@sveltejs/kit"
import type { PageServerLoad } from "./$types"

// /ragservice was renamed to /datasources/ragservice once "Datakilder" grew tabs for MCP and
// Websites alongside document search. Kept as a thin redirect for old bookmarks/links.
export const load: PageServerLoad = () => {
	redirect(308, "/datasources/ragservice")
}
