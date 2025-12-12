import type { RequestEvent } from "@sveltejs/kit"
import type { AuthenticatedUser } from "$lib/types/authentication"

type MiddlewareNextResponse = {
	response: Response
	isAuthorized: boolean
}

type MiddlewareNextParams = {
	requestEvent: RequestEvent
	user: AuthenticatedUser
}

export type MiddlewareNextFunction = (params: MiddlewareNextParams) => Promise<MiddlewareNextResponse>
