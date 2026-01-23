import type { AppRoles } from "./types/app-config"
import type { AuthenticatedPrincipal } from "./types/authentication"
import type { Chat, ChatConfig } from "./types/chat"

export const canViewAllChatConfigs = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.AGENT_MAINTAINER) || user.roles.includes(appRoles.ADMIN)
}

export const canEditPredefinedConfig = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.AGENT_MAINTAINER) || user.roles.includes(appRoles.ADMIN)
}

export const canPublishChatConfig = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.AGENT_MAINTAINER) || user.roles.includes(appRoles.ADMIN)
}

export const canEditChatConfig = (chat: Chat, user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	if (chat.config._id === "") {
		return true
	}
	if (user.roles.includes(appRoles.ADMIN) || user.roles.includes(appRoles.AGENT_MAINTAINER)) {
		return true
	}
	if (chat.config.type === "private" && chat.config.created.by.id === user.userId) {
		return true
	}
	return false
}

export const canUpdateChatConfig = (user: AuthenticatedPrincipal, appRoles: AppRoles, chatConfigToUpdate: ChatConfig, chatConfigInput: ChatConfig): boolean => {
	if (chatConfigToUpdate._id !== chatConfigInput._id) {
		throw new Error("canUpdateChatConfig: chatConfigToUpdate._id does not match chatConfigInput._id - please provide the correct chatConfigToUpdate")
	}
	if (user.roles.includes(appRoles.ADMIN) || user.roles.includes(appRoles.AGENT_MAINTAINER)) {
		return true
	}
	if (chatConfigToUpdate.type !== "private") {
		return false
	}
	if (chatConfigInput.type !== "private") {
		return false
	}
	if (chatConfigInput.vendorAgent) {
		return false
	}
	if (chatConfigToUpdate.created.by.id === user.userId) {
		return true
	}
	return false
}

export const canPromptPredefinedConfig = (user: AuthenticatedPrincipal, appRoles: AppRoles, vendorAgentId: string, chatConfigsWithVendorAgentId: ChatConfig[]): boolean => {
	if (user.roles.includes(appRoles.AGENT_MAINTAINER) || user.roles.includes(appRoles.ADMIN)) {
		return true
	}
	const configWithAccess = chatConfigsWithVendorAgentId.find((config) => {
		if (config.type === "published") {
			if (config.accessGroups === "all") {
				return true
			}
			if (Array.isArray(config.accessGroups)) {
				return config.accessGroups.some((group) => user.groups.includes(group))
			}
		}
		return false
	})
	if (!configWithAccess) {
		return false
	}
	if (configWithAccess.vendorAgent?.id !== vendorAgentId) {
		throw new Error(
			`canPromptPredefinedConfig: vendorAgentId ${vendorAgentId} does not match chatConfig.vendorAgent.id: ${configWithAccess.vendorAgent?.id}. Please provide chatConfigsWithVendorAgentId filtered by vendorAgentId.`
		)
	}
	return true
}
