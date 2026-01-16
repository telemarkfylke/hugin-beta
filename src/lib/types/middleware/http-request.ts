import type { RequestEvent } from "@sveltejs/kit"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"

type ApiNextResponse = {
	response: Response
	isAuthorized: boolean
}

type ApiNextParams = {
	requestEvent: RequestEvent
	user: AuthenticatedPrincipal
}

export type ApiNextFunction = (params: ApiNextParams) => Promise<ApiNextResponse>

type ServerLoadNextResponse<T> = {
	data: T
	isAuthorized: boolean
}

type ServerLoadNextParams = {
	requestEvent: RequestEvent
	user: AuthenticatedPrincipal
}

export type ServerLoadNextFunction<T> = (params: ServerLoadNextParams) => Promise<ServerLoadNextResponse<T>>
