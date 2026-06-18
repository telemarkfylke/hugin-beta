import type { AppConfig, AppRoles } from "./types/app-config"
import type { AuthenticatedPrincipal } from "./types/authentication"
import type { Chat, ChatConfig } from "./types/chat"

export const canViewAllChatConfigs = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.ADMIN)
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
	if (user.roles.includes(appRoles.ADMIN)) {
		return true
	}
	if (chat.config.type === "published" && user.roles.includes(appRoles.AGENT_MAINTAINER)) {
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
	if (user.roles.includes(appRoles.ADMIN)) {
		return true
	}
	if (chatConfigToUpdate.created.by.id === user.userId) {
		return true
	}
	if (chatConfigToUpdate.type === "published" && user.roles.includes(appRoles.AGENT_MAINTAINER)) {
		return true
	}
	return false
}

export const canUseCanvas = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.EMPLOYEE) || user.roles.includes(appRoles.ADMIN)
}

export const canPromptConfig = (user: AuthenticatedPrincipal, appConfig: AppConfig, chatConfig: ChatConfig): boolean => {
	if (user.roles.includes(appConfig.APP_ROLES.ADMIN)) {
		return true
	}
	if (chatConfig.shared) {
		return true
	}
	if (chatConfig.type === "private" && chatConfig.created.by.id === user.userId) {
		return true
	}
	if (chatConfig.type === "published") {
		if (user.roles.includes(appConfig.APP_ROLES.AGENT_MAINTAINER)) {
			return true
		}
		if (chatConfig.accessGroups.includes("all")) {
			return true
		}
		if (chatConfig.accessGroups.includes("employee") && user.roles.includes(appConfig.APP_ROLES.EMPLOYEE)) {
			return true
		}
		if (chatConfig.accessGroups.includes("edu_employee") && user.roles.includes(appConfig.APP_ROLES.EDU_EMPLOYEE)) {
			return true
		}
		if (chatConfig.accessGroups.includes("student") && (user.roles.includes(appConfig.APP_ROLES.STUDENT) || user.roles.includes(appConfig.APP_ROLES.EDU_EMPLOYEE))) {
			return true
		}
		if (chatConfig.accessGroups.some((group) => typeof group !== "string" && user.groups.includes(group.id))) {
			return true
		}
	}
	return false
}
