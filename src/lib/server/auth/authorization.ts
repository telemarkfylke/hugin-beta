import { env } from "$env/dynamic/private"
import type { DBAgent } from "$lib/types/agents"
import type { AuthenticatedUser } from "$lib/types/authentication"
import type { DBConversation } from "$lib/types/conversation"

export const canCreateAgent = (user: AuthenticatedUser): boolean => {
	return user.roles.includes(env.APP_ROLE_ADMIN) || user.roles.includes(env.APP_ROLE_AGENT_MAINTAINER)
}

export const canEditAgent = (user: AuthenticatedUser, _agent: DBAgent): boolean => {
	return canCreateAgent(user) // Same for now
}

export const canViewAllAgents = (user: AuthenticatedUser): boolean => {
	return canCreateAgent(user) // Same for now
}

export const canPromptAgent = (user: AuthenticatedUser, agent: DBAgent): boolean => {
	if (user.roles.includes(env.APP_ROLE_ADMIN)) {
		return true
	}
	if (user.roles.includes(env.APP_ROLE_AGENT_MAINTAINER)) {
		return true
	}
	if (agent.authorizedGroupIds === "all") {
		return true
	}
	return user.groups.some((groupId) => agent.authorizedGroupIds.includes(groupId))
}

export const canViewConversation = (user: AuthenticatedUser, conversation: DBConversation): boolean => {
	if (user.roles.includes(env.APP_ROLE_ADMIN)) {
		return true
	}
	if (conversation.owner.objectId === user.userId) {
		return true
	}
	return false
}

export const canDeleteConversation = (user: AuthenticatedUser, conversation: DBConversation): boolean => {
	return canViewConversation(user, conversation) // Same for now
}

export const canViewVendorConversations = (user: AuthenticatedUser): boolean => {
	return user.roles.includes(env.APP_ROLE_ADMIN)
}

export const canDeleteVendorConversation = (user: AuthenticatedUser): boolean => {
	return user.roles.includes(env.APP_ROLE_ADMIN)
}

export const canViewVendorVectorStores = (user: AuthenticatedUser): boolean => {
	return user.roles.includes(env.APP_ROLE_ADMIN) || user.roles.includes(env.APP_ROLE_AGENT_MAINTAINER)
}

export const canManageVendorVectorStores = (user: AuthenticatedUser): boolean => {
	return canViewVendorVectorStores(user) // Same for now
}

export const canDeleteVendorVectorStore = (user: AuthenticatedUser): boolean => {
	return canViewVendorVectorStores(user) // Same for now
}
