import type { AppConfig, AppRoles } from "./types/app-config"
import type { AuthenticatedPrincipal } from "./types/authentication"
import type { Chat, ChatConfig, RoleAccessGroups } from "./types/chat"

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
		throw new Error("canUpdateChatConfig: ID mismatch between existing and input config")
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

// Delete is intentionally more restrictive than update: only the creator or an admin may delete.
// AgentMaintainers may update published configs they don't own, but they may NOT delete them.
export const canDeleteChatConfig = (user: AuthenticatedPrincipal, appRoles: AppRoles, chatConfig: ChatConfig): boolean => {
	if (user.roles.includes(appRoles.ADMIN)) {
		return true
	}
	if (chatConfig.created.by.id === user.userId) {
		return true
	}
	return false
}

/**
 * Returns the set of role-based access group keys that the given user qualifies for.
 * Used by both the mock and Mongo stores to build access queries without duplicating logic.
 */
export const getUserRoleAccessGroups = (user: AuthenticatedPrincipal, appRoles: AppRoles): RoleAccessGroups[] => {
	const groups: RoleAccessGroups[] = ["all"]
	if (user.roles.includes(appRoles.EMPLOYEE)) groups.push("employee")
	if (user.roles.includes(appRoles.EDU_EMPLOYEE)) {
		groups.push("edu_employee")
		groups.push("student")
	}
	if (user.roles.includes(appRoles.STUDENT) && !groups.includes("student")) groups.push("student")
	return groups
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
		const userRoleGroups = getUserRoleAccessGroups(user, appConfig.APP_ROLES)
		if (chatConfig.accessGroups.some((group) => typeof group === "string" && userRoleGroups.includes(group))) {
			return true
		}
		if (chatConfig.accessGroups.some((group) => typeof group !== "string" && user.groups.includes(group.id))) {
			return true
		}
	}
	return false
}
