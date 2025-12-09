import { logger } from "@vestfoldfylke/loglady";
import { getAuthenticatedUser } from "../auth/get-authenticated-user";
import type { AuthenticatedUser } from "$lib/types/authentication";
import { HTTPError } from "./http-error";
import type { RequestEvent } from "@sveltejs/kit";

type MiddlewareNextResponse = {
	response: Response
	isAuthorized: boolean
}

type MiddlewareNextParams = {
  requestEvent: RequestEvent;
  user: AuthenticatedUser;
}

export type MiddlewareNextFunction = (params: MiddlewareNextParams) => Promise<MiddlewareNextResponse>;

/**
 * Wrap functionality in a server route with this middleware to handle authentication, some simple logging and error handling.
 * The `next` function will only be called if authentication is successful.
 * Make sure to handle authorization (access to resources) inside the `next` function and either throw a HTTPError or return `isAuthorized: false` if the caller is not authorized to access the requested resource.
 * 
 * @param {RequestEvent} requestEvent The incoming request event from SvelteKit server route
 * @param {MiddlewareNextFunction} next The middleware next function to call if authentication is successful, passing in the request event and authenticated user
 * @returns {Promise<Response>} The final response to return to the client
 */
export const httpRequestMiddleWare = async (requestEvent: RequestEvent, next: (params: MiddlewareNextParams) => Promise<MiddlewareNextResponse>): Promise<Response> => {
  const request = requestEvent.request;
  let loggerPrefix = `[HTTP Request Middleware] - ${request.method} ${request.url}`;

  logger.info(`${loggerPrefix} - Incoming request`);

  let user: AuthenticatedUser;
  try {
    user = getAuthenticatedUser(request.headers);
    loggerPrefix += ` - User: ${user.userId} (${user.name})`;
    logger.info(`${loggerPrefix} - Authenticated user: {userId}`, user.userId);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`${loggerPrefix} - Error during authentication: {error}`, errorMsg);
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const { response, isAuthorized } = await next({ requestEvent, user });
    if (!isAuthorized) {
      logger.warn(`${loggerPrefix} - User {userId} is not authorized to access this resource`, user.userId);
      return new Response("Forbidden", { status: 403 });
    }
    logger.info(`${loggerPrefix} - Request processed successfully for user {userId}`, user.userId);
    if (!(response instanceof Response)) {
      logger.error(`${loggerPrefix} - Next function did not return a valid Response object`);
      return new Response("Internal Server Error", { status: 500 });
    }
    return response;
  } catch (error) {
    if (error instanceof HTTPError) {
      logger.error(`${loggerPrefix} - HTTP Error {status}: {message}`, error.status, error.message);
      return new Response(error.message, { status: error.status });
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`${loggerPrefix} - Internal Server Error: {error}`, errorMsg);
    return new Response("Internal Server Error", { status: 500 });
  }
}