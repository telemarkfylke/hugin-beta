import { redirect } from "@sveltejs/kit"
import type { PageServerLoad } from "./$types"

// Bare /datasources has no content of its own - always redirects to a specific tab. Which one
// depends on role now that the tabs have different audiences (see +layout.server.ts):
// employees/admins land on Dokumentsøk (the original default), everyone else (students,
// edu_employee-only) lands on Websites - the only tab canUseWebsiteDataSource actually grants
// them. Reuses the layout's already-computed canUseRagservice via parent() rather than
// re-resolving the principal here - a plain redirect() thrown from inside
// serverLoadRequestMiddleware's next() would get caught by its generic error handler and turned
// into a 500, so this route deliberately stays outside that wrapper, same as before.
export const load: PageServerLoad = async ({ parent }) => {
	const { canUseRagservice } = await parent()
	redirect(307, canUseRagservice ? "/datasources/ragservice" : "/datasources/web")
}
