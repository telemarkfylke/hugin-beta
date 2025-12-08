import { getAuthenticatedUser } from "$lib/server/auth/get-authenticated-user"
import type { AuthenticatedUser } from "$lib/types/authentication"
import type { LayoutServerLoad } from "./$types"

export const load: LayoutServerLoad = async ({ request }): Promise<{ authenticatedUser: AuthenticatedUser }> => {
	const authenticatedUser = getAuthenticatedUser(request.headers)
	return { authenticatedUser }
}
