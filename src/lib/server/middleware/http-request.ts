import { json, error as svelteError, type RequestEvent } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ApiNextFunction, ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import { getAuthenticatedPrincipal } from "../auth/get-authenticated-user"
import { HTTPError } from "./http-error"

/**
 * Wrap functionality in a server route with this middleware to handle authentication, some simple logging and error handling.
 * The `next` function will only be called if authentication is successful.
 * Make sure to handle authorization (access to resources) inside the `next` function and either throw a HTTPError or return `isAuthorized: false` if the caller is not authorized to access the requested resource.
 *
 * @param {RequestEvent} requestEvent The incoming request event from SvelteKit server route
 * @param {MiddlewareNextFunction} next The middleware next function to call if authentication is successful, passing in the request event and authenticated user
 * @returns {Promise<Response>} The final response to return to the client
 */
export const apiRequestMiddleware = async (requestEvent: RequestEvent, next: ApiNextFunction): Promise<Response> => {
	const request = requestEvent.request
	let loggerPrefix = `[API Request Middleware] - ${request.method} ${request.url}`

	logger.info(`${loggerPrefix} - Incoming request`)

	let user: AuthenticatedPrincipal
	try {
		user = getAuthenticatedPrincipal(request.headers)
		loggerPrefix += ` - User: ${user.userId} (${user.name})`
		logger.info(`${loggerPrefix} - Authenticated user: {userId}`, user.userId)
	} catch (error) {
		logger.errorException(error, `${loggerPrefix} - Error during authentication`)
		return json({ message: "Unauthorized" }, { status: 401 })
	}
	try {
		const { response, isAuthorized } = await next({ requestEvent, user })
		if (!isAuthorized) {
			logger.warn(`${loggerPrefix} - User {userId} is not authorized to access this resource`, user.userId)
			return json({ message: "Forbidden" }, { status: 403 })
		}
		logger.info(`${loggerPrefix} - Request processed successfully for user {userId}`, user.userId)
		if (!(response instanceof Response)) {
			logger.error(`${loggerPrefix} - Next function did not return a valid Response object`)
			return json({ message: "Internal Server Error" }, { status: 500 })
		}
		return response
	} catch (error) {
		if (error instanceof HTTPError) {
			logger.errorException(error, `${loggerPrefix} - HTTP Error {status}`, error.status)
			return json({ message: error.message, data: error.data || null }, { status: error.status })
		}
		logger.errorException(error, `${loggerPrefix} - Internal Server Error`)
		return json({ message: "Internal Server Error" }, { status: 500 })
	}
}

/**
 * Wrap functionality in a server route with this middleware to handle authentication, some simple logging and error handling.
 * The `next` function will only be called if authentication is successful.
 * Make sure to handle authorization (access to resources) inside the `next` function and either throw a HTTPError or return `isAuthorized: false` if the caller is not authorized to access the requested resource.
 *
 * @param {RequestEvent} requestEvent The incoming request event from SvelteKit server route
 * @param {ServerLoadNextFunction} next The middleware next function to call if authentication is successful, passing in the request event and authenticated user
 * @returns {Promise<Response>} The final response to return to the client
 */
export const serverLoadRequestMiddleware = async <T>(requestEvent: RequestEvent, next: ServerLoadNextFunction<T>): Promise<T> => {
	const request = requestEvent.request
	let loggerPrefix = `[Server load Request Middleware] - ${request.method} ${request.url}`

	logger.info(`${loggerPrefix} - Incoming request`)

	let user: AuthenticatedPrincipal
	try {
		user = getAuthenticatedPrincipal(request.headers)
		loggerPrefix += ` - User: ${user.userId} (${user.name})`
		logger.info(`${loggerPrefix} - Authenticated user: {userId}`, user.userId)
	} catch (error) {
		logger.errorException(error, `${loggerPrefix} - Error during authentication`)
		svelteError(401, "Unauthorized")
	}
	let data: T
	let isAuthorized: boolean
	try {
		const nextResult = await next({ requestEvent, user })
		data = nextResult.data
		isAuthorized = nextResult.isAuthorized
	} catch (error) {
		if (error instanceof HTTPError) {
			logger.errorException(error, `${loggerPrefix} - HTTP Error {status}`, error.status)
			svelteError(error.status, error.message)
		}
		logger.errorException(error, `${loggerPrefix} - Internal Server Error`)
		svelteError(500, "Internal Server Error")
	}
	if (!isAuthorized) {
		logger.warn(`${loggerPrefix} - User {userId} is not authorized to access this resource`, user.userId)
		svelteError(403, "Forbidden")
	}
	logger.info(`${loggerPrefix} - Request processed successfully for user {userId}`, user.userId)
	return data
}
