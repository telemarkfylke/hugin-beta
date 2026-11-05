import type { Affiliation, AuthenticatedPrincipal } from "./types/authentication"
import type { Chat, ChatConfig, EntraAccessGroup, RoleAccessGroups } from "./types/chat"
import type { McpSource } from "./types/mcp-source"
import type { WebsiteSource } from "./types/website-source"

export const isAdmin = (user: AuthenticatedPrincipal): boolean => user.huginRoles.includes("admin")

export const isAgentMaintainer = (user: AuthenticatedPrincipal): boolean => user.huginRoles.includes("agentMaintainer")

export const hasAffiliation = (user: AuthenticatedPrincipal, affiliation: Affiliation): boolean => user.affiliations.includes(affiliation)

export const canViewAllChatConfigs = (user: AuthenticatedPrincipal): boolean => {
	return isAdmin(user)
}

export const canEditPredefinedConfig = (user: AuthenticatedPrincipal): boolean => {
	return isAgentMaintainer(user) || isAdmin(user)
}

export const canPublishChatConfig = (user: AuthenticatedPrincipal): boolean => {
	return isAgentMaintainer(user) || isAdmin(user)
}

// Gates ChatConfig.allowAnonymousEmbed - independent of type/canPublishChatConfig, since an
// anonymous, unauthenticated embed is a materially bigger exposure than sharing with other
// logged-in users. Deliberately stricter (admin-only) than "published".
export const canSetAnonymousEmbed = (user: AuthenticatedPrincipal): boolean => {
	return isAdmin(user)
}

// The anonymous-embed rate limits are admin-only like the toggle itself - the UI only shows them to
// admins. Pass previous = null on create, where any value set counts as a change.
export const anonymousEmbedRateLimitsChanged = (previous: ChatConfig | null, input: ChatConfig): boolean =>
	input.rateLimitPerIpPerMinute !== previous?.rateLimitPerIpPerMinute ||
	input.rateLimitPerIpPerDay !== previous?.rateLimitPerIpPerDay ||
	input.rateLimitPerBotPerDay !== previous?.rateLimitPerBotPerDay

export const canEditChatConfig = (chat: Chat, user: AuthenticatedPrincipal): boolean => {
	if (chat.config._id === "") {
		return true
	}
	if (isAdmin(user)) {
		return true
	}
	if (chat.config.type === "published" && isAgentMaintainer(user)) {
		return true
	}
	if (chat.config.type === "private" && chat.config.created.by.id === user.userId) {
		return true
	}
	return false
}

export const canUpdateChatConfig = (user: AuthenticatedPrincipal, chatConfigToUpdate: ChatConfig, chatConfigInput: ChatConfig): boolean => {
	if (chatConfigToUpdate._id !== chatConfigInput._id) {
		throw new Error("canUpdateChatConfig: chatConfigToUpdate._id does not match chatConfigInput._id - please provide the correct chatConfigToUpdate")
	}
	if (isAdmin(user)) {
		return true
	}
	// Only gate an actual attempted CHANGE to allowAnonymousEmbed - not every update to a config
	// that already has it set. Otherwise a non-admin owner would be permanently locked out of
	// deleting/editing their own config (DELETE calls this with chatConfigToUpdate === chatConfigInput,
	// so the value never "changes" there either way) the moment an admin turns the flag on for them.
	if (chatConfigInput.allowAnonymousEmbed !== chatConfigToUpdate.allowAnonymousEmbed && !canSetAnonymousEmbed(user)) {
		return false
	}
	if (anonymousEmbedRateLimitsChanged(chatConfigToUpdate, chatConfigInput) && !canSetAnonymousEmbed(user)) {
		return false
	}
	// Same rule for who may see it: create already requires canPublishChatConfig for "published", and
	// without this an owner could create a private assistant and then publish it to everyone by PUT.
	const audienceChanged = chatConfigInput.type !== chatConfigToUpdate.type || JSON.stringify(chatConfigInput.accessGroups) !== JSON.stringify(chatConfigToUpdate.accessGroups)
	if (audienceChanged && !canPublishChatConfig(user)) {
		return false
	}
	if (chatConfigToUpdate.created.by.id === user.userId) {
		return true
	}
	if (chatConfigToUpdate.type === "published" && isAgentMaintainer(user)) {
		return true
	}
	return false
}

// Which role may use which *feature* (canvas, ragservice, MCP, website sources, transcription,
// history) is not decided here - it's the DB matrix in $lib/featureflags, edited on /admin/features
// (server: hasFeature(), client: data.features). What stays in this file are rules that must never
// be one checkbox away: admin-only security gates and ownership checks.

// Editing the feature matrix itself - admin-only, and deliberately not a feature flag
export const canManageFeatureFlags = (user: AuthenticatedPrincipal): boolean => {
	return isAdmin(user)
}

// Same accessGroups semantics as ChatConfig.accessGroups/canPromptConfig - reused here so a
// FeatureSpotlight's audience is declared the same way an agent's audience is, rather than a
// second bespoke convention. ADMIN always sees everything, mirroring canPromptConfig.
// One deliberate difference: "student" means the STUDENT role only. For assistants it includes
// EDU_EMPLOYEE (teachers see what students get), but a student announcement isn't news to teachers.
// NB: canChooseProfile is built on this function, so the same applies to profile roles.
export const canSeeSpotlight = (user: AuthenticatedPrincipal, accessGroups: (RoleAccessGroups | EntraAccessGroup)[]): boolean => {
	if (isAdmin(user)) {
		return true
	}
	if (accessGroups.includes("all")) {
		return true
	}
	if (accessGroups.includes("employee") && hasAffiliation(user, "employee")) {
		return true
	}
	if (accessGroups.includes("edu_employee") && hasAffiliation(user, "edu_employee")) {
		return true
	}
	if (accessGroups.includes("student") && hasAffiliation(user, "student")) {
		return true
	}
	return accessGroups.some((group) => typeof group !== "string" && user.groups.includes(group.id))
}

// Who may choose a model profile (models.config.ts PROFILES[].roles). Same semantics as
// canSeeSpotlight, except an explicitly empty list means nobody - admins included - so a profile
// can be taken out of the picker while assistants already on it keep it.
export const canChooseProfile = (user: AuthenticatedPrincipal, roles: RoleAccessGroups[] | undefined): boolean => {
	if (roles !== undefined && roles.length === 0) {
		return false
	}
	return canSeeSpotlight(user, roles ?? ["all"])
}

// Managing MCP sources (the /datasources/mcp tab, create/edit/delete, SharePoint browsing) is
// admin-only - the MCP connection is one shared, unscoped service credential, so configuring a
// source effectively grants access to anything it can see. The "mcpSharepoint" feature flag still
// gates *using* MCP (picking visible sources in ChatConfigPanel, chatting with bots that have them).
export const canManageMcpSources = (user: AuthenticatedPrincipal): boolean => {
	return isAdmin(user)
}

// Managing website sources (the /datasources/web tab, create/edit/delete) is temporarily
// admin-only, while the "websiteSources" feature flag decides who may use existing ones. The
// hosting network only allows outbound traffic to an allow-list of domains, so most sources fail
// with ECONNREFUSED - not something to offer users until that's resolved.
export const canManageWebsiteSources = (user: AuthenticatedPrincipal): boolean => {
	return isAdmin(user)
}

// The mcpSharepoint/websiteSources feature flags only gate whether someone can use the *feature* at
// all (create their own sources, pick from visible ones). The two pairs below are the ownership layer
// on top - mirroring canEditChatConfig/canUpdateChatConfig's private/published + owner model. Added
// after a real incident: every MCP/website source was visible to, and editable/deletable by, every
// employee regardless of who created it, the moment this went from single-developer testing to a
// shared environment.

export const canViewMcpSource = (source: McpSource, user: AuthenticatedPrincipal): boolean => {
	if (isAdmin(user)) return true
	if (source.type === "published") return true
	return source.createdBy.id === user.userId
}

export const canEditMcpSource = (source: McpSource, user: AuthenticatedPrincipal): boolean => {
	if (isAdmin(user)) return true
	return source.createdBy.id === user.userId
}

export const canViewWebsiteSource = (source: WebsiteSource, user: AuthenticatedPrincipal): boolean => {
	if (isAdmin(user)) return true
	if (source.type === "published") return true
	return source.createdBy.id === user.userId
}

export const canEditWebsiteSource = (source: WebsiteSource, user: AuthenticatedPrincipal): boolean => {
	if (isAdmin(user)) return true
	return source.createdBy.id === user.userId
}

export const canPromptConfig = (user: AuthenticatedPrincipal, chatConfig: ChatConfig): boolean => {
	if (isAdmin(user)) {
		return true
	}
	if (chatConfig.shared || chatConfig.allowAnonymousEmbed) {
		return true
	}
	if (chatConfig.type === "private" && chatConfig.created.by.id === user.userId) {
		return true
	}
	if (chatConfig.type === "published") {
		if (isAgentMaintainer(user)) {
			return true
		}
		if (chatConfig.accessGroups.includes("all")) {
			return true
		}
		if (chatConfig.accessGroups.includes("employee") && hasAffiliation(user, "employee")) {
			return true
		}
		if (chatConfig.accessGroups.includes("edu_employee") && hasAffiliation(user, "edu_employee")) {
			return true
		}
		if (chatConfig.accessGroups.includes("student") && (hasAffiliation(user, "student") || hasAffiliation(user, "edu_employee"))) {
			return true
		}
		if (chatConfig.accessGroups.some((group) => typeof group !== "string" && user.groups.includes(group.id))) {
			return true
		}
	}
	return false
}
