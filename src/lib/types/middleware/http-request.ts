import type { RequestEvent } from "@sveltejs/kit"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"

type MiddlewareNextResponse = {
	response: Response
	isAuthorized: boolean
}

type MiddlewareNextParams = {
	requestEvent: RequestEvent
	user: AuthenticatedPrincipal
}

export type MiddlewareNextFunction = (params: MiddlewareNextParams) => Promise<MiddlewareNextResponse>
