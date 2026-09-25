import { canSeeSpotlight } from "../authorization"
import { HTTPError } from "../server/middleware/http-error"
import type { AppConfig } from "../types/app-config"
import type { AuthenticatedPrincipal } from "../types/authentication"
import { type ChatConfig, ChatConfigSchema } from "../types/chat"

// "use": /api/chat on every message - no role/admin checks on profile/pinned (resolution handles unusable values).
// "save": creating/updating an assistant. Checks only fire on values that CHANGED vs previous, so a non-admin
// co-editor isn't locked out by an admin's pin or a profile they couldn't choose themselves.
export type ParseChatConfigOptions = { mode: "use" } | { mode: "save"; user: AuthenticatedPrincipal; previous: ChatConfig | null }

const samePinned = (a: ChatConfig["pinned"], b: ChatConfig["pinned"]): boolean => a?.model === b?.model && a?.project === b?.project

const validateSavedModelSelection = (config: Pick<ChatConfig, "profile" | "pinned">, APP_CONFIG: AppConfig, user: AuthenticatedPrincipal, previous: ChatConfig | null): void => {
	// Without profile/pinned the store would map vendorId/model to a profile (LEGACY/profile-model match)
	// that never went through the role check below - e.g. a student naming the "lokal" model directly.
	if (config.profile === undefined && !config.pinned) {
		throw new HTTPError(400, "profile is required")
	}
	if (config.profile !== undefined && config.profile !== previous?.profile) {
		const profile = APP_CONFIG.MODEL_PROFILES.find((p) => p.id === config.profile)
		if (!profile) {
			throw new HTTPError(400, `Unsupported profile: ${config.profile}`)
		}
		if (!canSeeSpotlight(user, APP_CONFIG.APP_ROLES, profile.roles ?? ["all"])) {
			throw new HTTPError(403, `Not authorized to choose profile: ${profile.id}`)
		}
	}
	if (!samePinned(config.pinned, previous?.pinned)) {
		if (!config.pinned) {
			// Removing a previously-set pin is a change too - only an admin may do it (same rule as
			// setting/changing one below), otherwise a non-admin co-editor could silently strip an
			// admin's pin just by omitting it from their save body.
			if (!user.roles.includes(APP_CONFIG.APP_ROLES.ADMIN)) {
				throw new HTTPError(403, "Only admins can remove a model pin")
			}
		} else {
			const pinned = config.pinned
			const vendor = Object.values(APP_CONFIG.VENDORS).find((v) => v.MODELS.some((m) => m.KEY === pinned.model))
			const model = vendor?.MODELS.find((m) => m.KEY === pinned.model)
			if (!vendor || !model || model.RETIRED || !vendor.ENABLED) {
				throw new HTTPError(400, `Unsupported pinned model: ${pinned.model}`)
			}
			if (!vendor.PROJECTS.includes(pinned.project)) {
				throw new HTTPError(400, `Unsupported project: ${pinned.project} for pinned model: ${pinned.model}`)
			}
			if (!user.roles.includes(APP_CONFIG.APP_ROLES.ADMIN)) {
				throw new HTTPError(403, "Only admins can pin a model")
			}
		}
	}
}

export const parseChatConfig = (input: unknown, APP_CONFIG: AppConfig, options: ParseChatConfigOptions): ChatConfig => {
	if (!input || typeof input !== "object") {
		throw new Error("Invalid chat config input")
	}
	const parsedConfig = ChatConfigSchema.parse(input)

	const VENDOR = APP_CONFIG.VENDORS[parsedConfig.vendorId]
	if (!VENDOR) {
		throw new HTTPError(400, `Unsupported vendorId: ${parsedConfig.vendorId}`)
	}
	// A manual config with a profile or pin has vendorId/project overwritten by resolution, so they're only
	// checked here for vendor agents and pre-profile configs. A resolved vendor that's disabled (a
	// dataLocation profile is never substituted, see resolve.ts) is answered with 503 by the chat routes.
	const selectedByProfile = !parsedConfig.vendorAgent && (parsedConfig.profile !== undefined || parsedConfig.pinned !== undefined)
	if (!selectedByProfile) {
		if (!VENDOR.PROJECTS.includes(parsedConfig.project)) {
			throw new HTTPError(400, `Unsupported project: ${parsedConfig.project} for vendorId: ${parsedConfig.vendorId}`)
		}
		if (!VENDOR.ENABLED) {
			throw new HTTPError(400, `VendorId: ${parsedConfig.vendorId} is not enabled`)
		}
	}
	if (parsedConfig.vendorAgent) {
		// Predefined config
		if (!parsedConfig.vendorAgent.id || typeof parsedConfig.vendorAgent.id !== "string") {
			throw new HTTPError(400, "vendorAgent.id must be a string")
		}
		if (parsedConfig.tools?.some((tool) => tool.type === "mcp")) {
			throw new HTTPError(400, "MCP tools are not supported on predefined vendor-agent configs")
		}
		if (parsedConfig.dataSources?.some((source) => source.type === "mcp")) {
			throw new HTTPError(400, "MCP data sources are not supported on predefined vendor-agent configs")
		}
		// Same reasoning as MCP above: website tool-calling runs through the same agentic loop,
		// which always builds its request from config.model/instructions - fields a predefined
		// vendor-agent config never has (it uses vendorAgent.id instead).
		if (parsedConfig.dataSources?.some((source) => source.type === "website")) {
			throw new HTTPError(400, "Website data sources are not supported on predefined vendor-agent configs")
		}
		return {
			_id: parsedConfig._id,
			name: parsedConfig.name,
			description: parsedConfig.description,
			vendorId: parsedConfig.vendorId,
			project: parsedConfig.project,
			vendorAgent: {
				id: parsedConfig.vendorAgent.id
			},
			dataSources: parsedConfig.dataSources,
			categories: parsedConfig.categories,
			shared: parsedConfig.shared,
			allowAnonymousEmbed: parsedConfig.allowAnonymousEmbed,
			scopeGuardEnabled: parsedConfig.scopeGuardEnabled,
			emptyRagGuardEnabled: parsedConfig.emptyRagGuardEnabled,
			rateLimitPerIpPerMinute: parsedConfig.rateLimitPerIpPerMinute,
			rateLimitPerIpPerDay: parsedConfig.rateLimitPerIpPerDay,
			rateLimitPerBotPerDay: parsedConfig.rateLimitPerBotPerDay,
			accessGroups: parsedConfig.accessGroups,
			type: parsedConfig.type,
			created: parsedConfig.created,
			updated: parsedConfig.updated
		}
	}
	// Manual config. With a profile or pin, vendorId/model are overwritten by resolution - only a
	// pre-profile config (neither set) still needs its model checked here.
	if (parsedConfig.profile === undefined && !parsedConfig.pinned && !VENDOR.MODELS.some((model) => model.ID === parsedConfig.model)) {
		throw new HTTPError(400, `Unsupported model: ${parsedConfig.model} for vendorId: ${parsedConfig.vendorId}`)
	}
	if (options.mode === "save") {
		validateSavedModelSelection(parsedConfig, APP_CONFIG, options.user, options.previous)
	}

	// NB : Husk å legge til propertiene i dette objektet også. Spesielt hvis det er optional så er det lett å glemme.
	return {
		_id: parsedConfig._id,
		name: parsedConfig.name,
		description: parsedConfig.description,
		vendorId: parsedConfig.vendorId,
		project: parsedConfig.project,
		model: parsedConfig.model,
		profile: parsedConfig.profile,
		pinned: parsedConfig.pinned,
		instructions: parsedConfig.instructions,
		conversationId: parsedConfig.conversationId,
		tools: parsedConfig.tools || [],
		dataSources: parsedConfig.dataSources,
		categories: parsedConfig.categories,
		shared: parsedConfig.shared,
		allowAnonymousEmbed: parsedConfig.allowAnonymousEmbed,
		scopeGuardEnabled: parsedConfig.scopeGuardEnabled,
		emptyRagGuardEnabled: parsedConfig.emptyRagGuardEnabled,
		rateLimitPerIpPerMinute: parsedConfig.rateLimitPerIpPerMinute,
		rateLimitPerIpPerDay: parsedConfig.rateLimitPerIpPerDay,
		rateLimitPerBotPerDay: parsedConfig.rateLimitPerBotPerDay,
		accessGroups: parsedConfig.accessGroups,
		type: parsedConfig.type,
		created: parsedConfig.created,
		updated: parsedConfig.updated
	}
}
