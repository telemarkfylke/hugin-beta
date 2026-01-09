import { getAuthenticatedPrincipal } from "$lib/server/auth/get-authenticated-user"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { LayoutServerLoad } from "./$types"

export const load: LayoutServerLoad = async ({ request }): Promise<{ authenticatedUser: AuthenticatedPrincipal }> => {
	const authenticatedUser = getAuthenticatedPrincipal(request.headers)
	return { authenticatedUser }
}
