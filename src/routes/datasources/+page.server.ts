import { redirect } from "@sveltejs/kit"
import type { PageServerLoad } from "./$types"

// Bare /datasources has no content of its own - always redirects to a specific tab. Employees and
// admins land on Dokumentsøk (the original default); anyone else who gets past the layout gate can
// only be an admin-only-tab user, so falls back to Websites. Reuses the layout's already-computed
// canUseRagservice via parent() rather than re-resolving the principal here - a plain redirect()
// thrown from inside serverLoadRequestMiddleware's next() would get caught by its generic error
// handler and turned into a 500, so this route deliberately stays outside that wrapper.
export const load: PageServerLoad = async ({ parent }) => {
	const { canUseRagservice } = await parent()
	redirect(307, canUseRagservice ? "/datasources/ragservice" : "/datasources/web")
}
