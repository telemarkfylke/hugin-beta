import ChatConfig from "./components/Chat/ChatConfig.svelte"
import type { AppRoles } from "./types/app-config"
import type { AuthenticatedPrincipal } from "./types/authentication"
import type { Chat } from "./types/chat"

export const canEditPredefinedConfig = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.AGENT_MAINTAINER) || user.roles.includes(appRoles.ADMIN)
}

export const canEditChatConfig = (chat: Chat, user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	if (chat.config.id === "") {
		return true
	}
	if (user.roles.includes(appRoles.ADMIN) || user.roles.includes(appRoles.AGENT_MAINTAINER)) {
		return true
	}
	return false
}

export const canUsePredefinedConfig = (chatConfig: ChatConfig, user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return false
}

// Hvis jeg prompter en predefinedConfig må backend sjekke at jeg har tilgang til den
/*
Hvis admin eller agent_maintainer så er det ok
Hvis ikke så må vi sjekke mot db om det finnes en eller annen config med vendorAgent.id som matcher id i request, og som caller har tilgang på. Hvis ikke så er det nono

*/
