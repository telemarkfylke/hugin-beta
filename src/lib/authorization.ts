import type { AppConfig, AppRoles } from "./types/app-config"
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

export const canPromptPredefinedConfig = (user: AuthenticatedPrincipal, appConfig: AppConfig, vendorAgentId: string, chatConfigsWithVendorAgentId: ChatConfig[]): boolean => {
	if (user.roles.includes(appConfig.APP_ROLES.AGENT_MAINTAINER) || user.roles.includes(appConfig.APP_ROLES.ADMIN)) {
		return true
	}
	const configWithAccess = chatConfigsWithVendorAgentId.find((config) => {
		if (!appConfig.AGENT_CONFIG_SHARE_DISABLED && config.shared === true) return true

		if (config.type === "published") {
			if (config.accessGroups.includes("all")) {
				return true
			}
			if (config.accessGroups.includes("employee") && user.roles.includes(appConfig.APP_ROLES.EMPLOYEE)) {
				return true
			}
			if (config.accessGroups.includes("edu_employee") && user.roles.includes(appConfig.APP_ROLES.EDU_EMPLOYEE)) {
				return true
			}
			if (config.accessGroups.includes("student") && user.roles.includes(appConfig.APP_ROLES.STUDENT)) {
				return true
			}
			return config.accessGroups.some((group) => typeof group !== "string" && user.groups.includes(group.id))
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
