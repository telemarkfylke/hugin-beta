import { canPublishChatConfig, canUpdateChatConfig } from "$lib/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { AppConfig } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig, NewChatConfig } from "$lib/types/chat"
import type { IChatConfigStore } from "$lib/types/db/db-interface"
import { omitChatConfigId } from "$lib/validation/chat-config"
import { parseChatConfig } from "$lib/validation/parse-chat-config"

export const listChatConfigs = async (user: AuthenticatedPrincipal, store: IChatConfigStore): Promise<ChatConfig[]> => {
	return store.getChatConfigs(user)
}

export const createChatConfig = async (body: unknown, user: AuthenticatedPrincipal, appConfig: AppConfig, store: IChatConfigStore): Promise<ChatConfig> => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	const chatConfig = parseChatConfig(body, appConfig)

	if (chatConfig.type === "published" && !canPublishChatConfig(user, appConfig.APP_ROLES)) {
		throw new HTTPError(403, "User is not authorized to create published chat configs")
	}

	const now = new Date().toISOString()
	const chatConfigToCreate: NewChatConfig = {
		...omitChatConfigId(chatConfig),
		name: chatConfig.name || "Ny agent",
		type: chatConfig.type,
		accessGroups: chatConfig.accessGroups,
		created: {
			at: now,
			by: {
				id: user.userId,
				name: user.name
			}
		},
		updated: {
			at: now,
			by: {
				id: user.userId,
				name: user.name
			}
		}
	}

	return store.createChatConfig(chatConfigToCreate)
}

export const replaceChatConfig = async (configId: string, body: unknown, user: AuthenticatedPrincipal, appConfig: AppConfig, store: IChatConfigStore): Promise<ChatConfig> => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	const chatConfig = parseChatConfig(body, appConfig)

	const existing = await store.getChatConfig(configId)
	if (!existing) {
		throw new HTTPError(404, "Chat config not found")
	}

	if (!canUpdateChatConfig(user, appConfig.APP_ROLES, existing, chatConfig)) {
		throw new HTTPError(403, "Not authorized to update this chat config")
	}

	const chatConfigUpdateData: NewChatConfig = {
		...omitChatConfigId(chatConfig),
		created: existing.created,
		updated: { at: new Date().toISOString(), by: { id: user.userId, name: user.name } }
	}
	return store.replaceChatConfig(configId, chatConfigUpdateData)
}

export const deleteChatConfig = async (configId: string, user: AuthenticatedPrincipal, appConfig: AppConfig, store: IChatConfigStore): Promise<void> => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	const existing = await store.getChatConfig(configId)
	if (!existing) {
		throw new HTTPError(404, "Chat config not found")
	}

	if (!canUpdateChatConfig(user, appConfig.APP_ROLES, existing, existing)) {
		throw new HTTPError(403, "Not authorized to delete this chat config")
	}

	await store.deleteChatConfig(configId)
}
