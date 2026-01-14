import type { AppRoles } from "./types/app-config"
import type { AuthenticatedPrincipal } from "./types/authentication"
import type { Chat } from "./types/chat"

export const canEditPredefinedConfig = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
  return user.roles.includes(appRoles.AGENT_MAINTAINER) || user.roles.includes(appRoles.ADMIN)
}

export const canEditChat = (chat: Chat, user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
  if (chat.config.id === "") {
    return true
  }
  if (user.roles.includes(appRoles.ADMIN) || user.roles.includes(appRoles.AGENT_MAINTAINER)) {
    return true
  }
  if (user.userId === chat.owner.id) {
    return true
  }
  return false
}