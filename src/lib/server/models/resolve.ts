import { logger } from "@vestfoldfylke/loglady"
import type { ChatConfig, VendorId } from "$lib/types/chat"
import { type ClientModelProfile, DEFAULT_PROJECT_ID } from "$lib/types/model-profiles"
import { resolveFilePreset } from "./derive-vendors"
import type { CatalogueModel, ModelConfig, Profile } from "./types"

export type ModelContext = {
	modelConfig: ModelConfig
	isVendorEnabled: (vendorId: VendorId) => boolean
}

// The fields resolution reads/writes - lets it work on both ChatConfig and NewChatConfig
export type ModelSelection = Pick<ChatConfig, "vendorId" | "project" | "model" | "profile" | "pinned" | "vendorAgent"> & { _id?: string }

export type ResolvedModel = { vendorId: VendorId; model: string; project: string }

const usableModel = (key: string, ctx: ModelContext): CatalogueModel | null => {
	const model = ctx.modelConfig.MODELS[key]
	if (!model || model.status === "retired" || model.internal || !ctx.isVendorEnabled(model.vendor)) {
		return null
	}
	return model
}

const usableProfile = (id: string, ctx: ModelContext): { profile: Profile; model: CatalogueModel } | null => {
	const profile = ctx.modelConfig.PROFILES.find((p) => p.id === id)
	const model = profile ? usableModel(profile.model, ctx) : null
	return profile && model ? { profile, model } : null
}

const legacyProfileId = (providerModel: string, ctx: ModelContext): string | undefined => {
	const { LEGACY, PROFILES, MODELS } = ctx.modelConfig
	return LEGACY[providerModel] ?? PROFILES.find((p) => MODELS[p.model]?.providerModel === providerModel)?.id
}

const fallbackProfile = (ctx: ModelContext) => {
	const preferred = usableProfile(ctx.modelConfig.DEFAULTS.assistant, ctx)
	if (preferred) {
		return preferred
	}
	for (const profile of ctx.modelConfig.PROFILES) {
		const usable = usableProfile(profile.id, ctx)
		if (usable) {
			return usable
		}
	}
	return null
}

// Order: pinned (if its model is usable) -> profile -> LEGACY/profile-model match for pre-profile
// configs -> DEFAULTS.assistant -> first usable profile. vendorId/model/project from the input are
// never trusted - they're always overwritten. Vendor-agent configs have no model and pass through.
export const resolveChatConfig = <T extends ModelSelection>(config: T, ctx: ModelContext): T => {
	if (config.vendorAgent) {
		return config
	}
	if (config.pinned) {
		const pinnedModel = usableModel(config.pinned.model, ctx)
		if (pinnedModel) {
			return { ...config, vendorId: pinnedModel.vendor, model: pinnedModel.providerModel, project: config.pinned.project }
		}
		logger.warn("Config {configId} is pinned to unusable model {model} - using its profile instead", config._id ?? "(new)", config.pinned.model)
	}

	const requestedProfileId = config.profile ?? (config.model ? legacyProfileId(config.model, ctx) : undefined)
	let resolved = requestedProfileId ? usableProfile(requestedProfileId, ctx) : null
	if (!resolved) {
		resolved = fallbackProfile(ctx)
		logger.warn("Config {configId} fell back to default profile (profile: {profile}, model: {model})", config._id ?? "(new)", config.profile ?? "none", config.model ?? "none")
	}
	if (!resolved) {
		throw new Error("No usable model profile - check models.config.ts and vendor API keys")
	}
	return { ...config, profile: resolved.profile.id, vendorId: resolved.model.vendor, model: resolved.model.providerModel, project: DEFAULT_PROJECT_ID }
}

export const resolveDefaultProfileId = (purpose: "chat" | "assistant", ctx: ModelContext): string | null => {
	return (usableProfile(ctx.modelConfig.DEFAULTS[purpose], ctx) ?? fallbackProfile(ctx))?.profile.id ?? null
}

// canvas: strict - null when its profile's vendor is disabled (routes answer 503).
// utility: skips the enabled check on purpose - it has always called LITELLM directly and failed at call time if missing.
export const resolveDefaultModel = (purpose: "chat" | "assistant" | "canvas" | "utility", ctx: ModelContext): ResolvedModel | null => {
	const { DEFAULTS, MODELS } = ctx.modelConfig
	if (purpose === "utility") {
		const utility = MODELS[DEFAULTS.utility]
		return utility ? { vendorId: utility.vendor, model: utility.providerModel, project: DEFAULT_PROJECT_ID } : null
	}
	const profileId = purpose === "canvas" ? DEFAULTS.canvas : resolveDefaultProfileId(purpose, ctx)
	const resolved = profileId ? usableProfile(profileId, ctx) : null
	return resolved ? { vendorId: resolved.model.vendor, model: resolved.model.providerModel, project: DEFAULT_PROJECT_ID } : null
}

export const buildClientProfiles = (ctx: ModelContext): ClientModelProfile[] => {
	return ctx.modelConfig.PROFILES.flatMap((profile) => {
		const model = usableModel(profile.model, ctx)
		if (!model) {
			return []
		}
		return [
			{
				id: profile.id,
				label: profile.label,
				icon: profile.icon,
				description: profile.description,
				dataLocation: profile.dataLocation,
				roles: profile.roles,
				vendorId: model.vendor,
				model: model.providerModel,
				project: DEFAULT_PROJECT_ID,
				capabilities: model.capabilities,
				mimeTypes: resolveFilePreset(model.files)
			}
		]
	})
}
