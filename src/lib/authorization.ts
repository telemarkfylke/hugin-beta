import type { AppConfig, AppRoles } from "./types/app-config"
import type { AuthenticatedPrincipal } from "./types/authentication"
import type { Chat, ChatConfig, EntraAccessGroup, RoleAccessGroups } from "./types/chat"
import type { McpSource } from "./types/mcp-source"
import type { WebsiteSource } from "./types/website-source"

export const canViewAllChatConfigs = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.ADMIN)
}

export const canEditPredefinedConfig = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.AGENT_MAINTAINER) || user.roles.includes(appRoles.ADMIN)
}

export const canPublishChatConfig = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.AGENT_MAINTAINER) || user.roles.includes(appRoles.ADMIN)
}

// Gates ChatConfig.allowAnonymousEmbed - independent of type/canPublishChatConfig, since an
// anonymous, unauthenticated embed is a materially bigger exposure than sharing with other
// logged-in users. Deliberately stricter (admin-only) than "published".
export const canSetAnonymousEmbed = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.ADMIN)
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
	// Only gate an actual attempted CHANGE to allowAnonymousEmbed - not every update to a config
	// that already has it set. Otherwise a non-admin owner would be permanently locked out of
	// deleting/editing their own config (DELETE calls this with chatConfigToUpdate === chatConfigInput,
	// so the value never "changes" there either way) the moment an admin turns the flag on for them.
	if (chatConfigInput.allowAnonymousEmbed !== chatConfigToUpdate.allowAnonymousEmbed && !canSetAnonymousEmbed(user, appRoles)) {
		return false
	}
	if (chatConfigToUpdate.created.by.id === user.userId) {
		return true
	}
	if (chatConfigToUpdate.type === "published" && user.roles.includes(appRoles.AGENT_MAINTAINER)) {
		return true
	}
	return false
}

// "Student-only" means STUDENT is the *only* role the user has - someone who is e.g. both STUDENT
// and EDU_EMPLOYEE does not count. Standalone on purpose: this is a plain role-identity check, not
// tied to any one feature - canUseHistory below happens to be built from it today, but other gates
// (e.g. Datakilder menu visibility) may key off this same identity independently, and shouldn't be
// wired through canUseHistory just because the two currently agree.
export const isStudentOnly = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.STUDENT) && user.roles.every((role) => role === appRoles.STUDENT)
}

// Gates conversation history everywhere, client and server - when false, incognito is forced and
// history is hidden. Student-only users (see isStudentOnly above) used to be blocked here; that
// restriction is now lifted and everyone gets history, same defaults as employees. The check is
// kept commented out (rather than removed along with the call sites) so it can be switched back
// on with a one-line change.
export const canUseHistory = (_user: AuthenticatedPrincipal, _appRoles: AppRoles): boolean => {
	// return !isStudentOnly(_user, _appRoles)
	return true
}

// Same accessGroups semantics as ChatConfig.accessGroups/canPromptConfig - reused here so a
// FeatureSpotlight's audience is declared the same way an agent's audience is, rather than a
// second bespoke convention. ADMIN always sees everything, mirroring canPromptConfig.
export const canSeeSpotlight = (user: AuthenticatedPrincipal, appRoles: AppRoles, accessGroups: (RoleAccessGroups | EntraAccessGroup)[]): boolean => {
	if (user.roles.includes(appRoles.ADMIN)) {
		return true
	}
	if (accessGroups.includes("all")) {
		return true
	}
	if (accessGroups.includes("employee") && user.roles.includes(appRoles.EMPLOYEE)) {
		return true
	}
	if (accessGroups.includes("edu_employee") && user.roles.includes(appRoles.EDU_EMPLOYEE)) {
		return true
	}
	if (accessGroups.includes("student") && (user.roles.includes(appRoles.STUDENT) || user.roles.includes(appRoles.EDU_EMPLOYEE))) {
		return true
	}
	return accessGroups.some((group) => typeof group !== "string" && user.groups.includes(group.id))
}

// Who may choose a model profile (models.config.ts PROFILES[].roles). Same semantics as
// canSeeSpotlight, except an explicitly empty list means nobody - admins included - so a profile
// can be taken out of the picker while assistants already on it keep it.
export const canChooseProfile = (user: AuthenticatedPrincipal, appRoles: AppRoles, roles: RoleAccessGroups[] | undefined): boolean => {
	if (roles !== undefined && roles.length === 0) {
		return false
	}
	return canSeeSpotlight(user, appRoles, roles ?? ["all"])
}

export const canUseCanvas = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.EMPLOYEE) || user.roles.includes(appRoles.ADMIN) || user.roles.includes(appRoles.EDU_EMPLOYEE) || user.roles.includes(appRoles.STUDENT)
}

export const canUseRagservice = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.EMPLOYEE) || user.roles.includes(appRoles.ADMIN)
}

export const canUseMcpSharepoint = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.EMPLOYEE) || user.roles.includes(appRoles.ADMIN)
}

// Managing MCP sources (the /datasources/mcp tab, create/edit/delete, SharePoint browsing) is
// admin-only - the MCP connection is one shared, unscoped service credential, so configuring a
// source effectively grants access to anything it can see. canUseMcpSharepoint above still gates
// *using* MCP (picking visible sources in ChatConfigPanel, chatting with bots that have them).
export const canManageMcpSources = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.ADMIN)
}

// Unlike Ragservice/MCP, Website sources touch no live external system and grant no org-wide
// search/document access - they're just admin-curated URLs a bot is allowed to fetch. Open to
// every authenticated user, students included: someone must still create/publish a source (or
// have one shared with them) before it's usable, so there's no meaningful "who can use the
// feature at all" gate left to apply here beyond being logged in.
export const canUseWebsiteDataSource = (_user: AuthenticatedPrincipal, _appRoles: AppRoles): boolean => {
	return true
}

// Managing website sources (the /datasources/web tab, create/edit/delete) is temporarily
// admin-only, while canUseWebsiteDataSource above still lets everyone use existing ones. The
// hosting network only allows outbound traffic to an allow-list of domains, so most sources fail
// with ECONNREFUSED - not something to offer users until that's resolved.
export const canManageWebsiteSources = (user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	return user.roles.includes(appRoles.ADMIN)
}

// canUse{Mcp,WebsiteData}Source above only gates whether someone can use the *feature* at all
// (create their own sources, pick from visible ones). The two pairs below are the ownership layer
// on top - mirroring canEditChatConfig/canUpdateChatConfig's private/published + owner model. Added
// after a real incident: every MCP/website source was visible to, and editable/deletable by, every
// employee regardless of who created it, the moment this went from single-developer testing to a
// shared environment.

export const canViewMcpSource = (source: McpSource, user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	if (user.roles.includes(appRoles.ADMIN)) return true
	if (source.type === "published") return true
	return source.createdBy.id === user.userId
}

export const canEditMcpSource = (source: McpSource, user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	if (user.roles.includes(appRoles.ADMIN)) return true
	return source.createdBy.id === user.userId
}

export const canViewWebsiteSource = (source: WebsiteSource, user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	if (user.roles.includes(appRoles.ADMIN)) return true
	if (source.type === "published") return true
	return source.createdBy.id === user.userId
}

export const canEditWebsiteSource = (source: WebsiteSource, user: AuthenticatedPrincipal, appRoles: AppRoles): boolean => {
	if (user.roles.includes(appRoles.ADMIN)) return true
	return source.createdBy.id === user.userId
}

export const canUseTranscription = (user: AuthenticatedPrincipal, appConfig: AppConfig): boolean => {
	if (user.roles.includes(appConfig.APP_ROLES.ADMIN)) {
		return true
	}
	return appConfig.TRANSCRIPTION_GREEN_GROUP_ID !== undefined && user.groups.includes(appConfig.TRANSCRIPTION_GREEN_GROUP_ID)
}

export const canPromptConfig = (user: AuthenticatedPrincipal, appConfig: AppConfig, chatConfig: ChatConfig): boolean => {
	if (user.roles.includes(appConfig.APP_ROLES.ADMIN)) {
		return true
	}
	if (chatConfig.shared || chatConfig.allowAnonymousEmbed) {
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
