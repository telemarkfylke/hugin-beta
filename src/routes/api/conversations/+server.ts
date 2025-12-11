import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { getDBUserConversations } from "$lib/server/agents/conversations"
import { canViewConversation } from "$lib/server/auth/authorization"
import { httpRequestMiddleware} from "$lib/server/middleware/http-request"
import type { GetConversationsResponse } from "$lib/types/api-responses"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"

const getConversations: MiddlewareNextFunction = async ({ user }) => {
	const userConversations = await getDBUserConversations(user.userId)

	const unauthorizedConversations = userConversations.filter((conv) => !canViewConversation(user, conv))
	const authorizedConversations = userConversations.filter((conv) => canViewConversation(user, conv))
	if (unauthorizedConversations.length > 0) {
		logger.warn(
			"User: {userId} got {count} conversations they are not authorized to view from db query. Filtered them out, but take a look at _ids {@ids}",
			user.userId,
			unauthorizedConversations.length,
			unauthorizedConversations.map((c) => c._id)
		)
	}

	return {
		response: json({ conversations: authorizedConversations } as GetConversationsResponse),
		isAuthorized: true
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getConversations)
}
