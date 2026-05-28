import { logger } from "@vestfoldfylke/loglady"
import { canDeleteChatConfig, canPublishChatConfig, canUpdateChatConfig } from "$lib/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { AppConfig } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig, NewChatConfig } from "$lib/types/chat"
import type { IChatConfigStore } from "$lib/types/db/db-interface"
import { omitChatConfigId } from "$lib/validation/chat-config"
import { parseChatConfig } from "$lib/validation/parse-chat-config"

logger.logConfig({ prefix: "hugin - chat-config-service" })

export const listChatConfigs = async (user: AuthenticatedPrincipal, store: IChatConfigStore): Promise<ChatConfig[]> => {
	logger.info("User {userId} listing chat configs", user.userId)
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

	const created = await store.createChatConfig(chatConfigToCreate)
	logger.info("Chat config created: {name} (type: {type}) by user {userId}", chatConfigToCreate.name, chatConfigToCreate.type, user.userId)
	return created
}

export const replaceChatConfig = async (configId: string, body: unknown, user: AuthenticatedPrincipal, appConfig: AppConfig, store: IChatConfigStore): Promise<ChatConfig> => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	const chatConfig = parseChatConfig(body, appConfig)

	if (chatConfig._id !== configId) {
		throw new HTTPError(400, "Config ID in request body does not match URL parameter")
	}

	const existing = await store.getChatConfig(configId)
	if (!existing) {
		throw new HTTPError(404, "Chat config not found")
	}

	if (!canUpdateChatConfig(user, appConfig.APP_ROLES, existing, chatConfig)) {
		logger.warn("Unauthorized attempt to update config {configId} by user {userId}", configId, user.userId)
		throw new HTTPError(403, "Not authorized to update this chat config")
	}

	const chatConfigUpdateData: NewChatConfig = {
		...omitChatConfigId(chatConfig),
		created: existing.created,
		updated: { at: new Date().toISOString(), by: { id: user.userId, name: user.name } }
	}
	const replaced = await store.replaceChatConfig(configId, chatConfigUpdateData)
	logger.info("Chat config replaced: {configId} by user {userId}", configId, user.userId)
	return replaced
}

export const deleteChatConfig = async (configId: string, user: AuthenticatedPrincipal, appConfig: AppConfig, store: IChatConfigStore): Promise<void> => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	const existing = await store.getChatConfig(configId)
	if (!existing) {
		throw new HTTPError(404, "Chat config not found")
	}

	if (!canDeleteChatConfig(user, appConfig.APP_ROLES, existing)) {
		logger.warn("Unauthorized attempt to delete config {configId} by user {userId}", configId, user.userId)
		throw new HTTPError(403, "Not authorized to delete this chat config")
	}

	await store.deleteChatConfig(configId)
	logger.info("Chat config deleted: {configId} by user {userId}", configId, user.userId)
}
