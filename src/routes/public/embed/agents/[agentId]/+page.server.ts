import { error } from "@sveltejs/kit"
import { getChatConfigStore } from "$lib/server/db/get-db"
import type { PageServerLoad } from "./$types"

const chatConfigStore = getChatConfigStore()

// No auth middleware at all - see +layout.server.ts isPublicRoute, which already returned an
// anonymous principal for this whole /public/** subtree before this load even runs. The only
// gate is allowAnonymousEmbed on the config itself, looked up fresh from the DB.
export const load: PageServerLoad = async ({ params }) => {
	const agent = await chatConfigStore.getChatConfig(params.agentId)
	// Same 404 whether the config doesn't exist or just isn't anonymously embeddable - never let
	// an anonymous caller distinguish "no such agent" from "exists but not public".
	if (!agent?.allowAnonymousEmbed) {
		error(404, "Not found")
	}
	return { agent }
}
