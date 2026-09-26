import { logger } from "@vestfoldfylke/loglady"
import type { ChatConfig, VendorId } from "$lib/types/chat"
import { type ClientModelProfile, DEFAULT_PROJECT_ID } from "$lib/types/model-profiles"
import { resolveFilePreset } from "./derive-vendors"
import type { CatalogueModel, ModelConfig, Profile } from "./types"

export type ModelContext = {
	modelConfig: ModelConfig
	isVendorEnabled: (vendorId: VendorId) => boolean
	// Configured API-key projects per vendor. Optional so pure tests can omit it (no legacy project pins then)
	vendorProjects?: (vendorId: VendorId) => string[]
}

// The fields resolution reads/writes - lets it work on both ChatConfig and NewChatConfig
export type ModelSelection = Pick<ChatConfig, "vendorId" | "project" | "model" | "profile" | "pinned" | "vendorAgent"> & { _id?: string }

export type ResolvedModel = { vendorId: VendorId; model: string; project: string }

// Object.hasOwn guards against a caller-supplied key like "constructor" or "__proto__" resolving to
// an inherited prototype value instead of a real (or absent) catalogue entry - the plain object
// literals in ModelConfig are indexed by input that can originate from a client (pinned.model,
// a stored legacy model id), not just trusted static config.
const usableModel = (key: string, ctx: ModelContext): CatalogueModel | null => {
	const model = Object.hasOwn(ctx.modelConfig.MODELS, key) ? ctx.modelConfig.MODELS[key] : undefined
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
	const legacy = Object.hasOwn(LEGACY, providerModel) ? LEGACY[providerModel] : undefined
	return legacy ?? PROFILES.find((p) => (Object.hasOwn(MODELS, p.model) ? MODELS[p.model] : undefined)?.providerModel === providerModel)?.id
}

// Pre-profile assistants could be saved on their own API-key project (e.g. a department's OpenAI key).
// Profiles always run on DEFAULT, so such an assistant becomes an implicit admin pin: its stored model if
// still usable, else the model of the profile it maps to - same vendor only, since project keys are per vendor.
const legacyProjectPin = (config: ModelSelection, ctx: ModelContext): { model: string; project: string } | undefined => {
	if (config.pinned || config.profile !== undefined || !config.model || !config.project || config.project === DEFAULT_PROJECT_ID) {
		return undefined
	}
	if (!(ctx.vendorProjects?.(config.vendorId) ?? []).includes(config.project)) {
		return undefined
	}
	const { MODELS, PROFILES } = ctx.modelConfig
	const storedKey = Object.keys(MODELS).find((key) => MODELS[key]?.vendor === config.vendorId && MODELS[key]?.providerModel === config.model)
	const mappedProfileId = legacyProfileId(config.model, ctx)
	const profileKey = PROFILES.find((p) => p.id === mappedProfileId)?.model
	const key = [storedKey, profileKey].find((k) => k !== undefined && usableModel(k, ctx)?.vendor === config.vendorId)
	return key ? { model: key, project: config.project } : undefined
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
//
// A requested profile that's KNOWN (exists in ctx.modelConfig.PROFILES) but currently unusable
// (its vendor is disabled, or its model is retired) keeps its own profile id in the result - only
// vendorId/model/project are served from the fallback. This matters because ResolvingChatConfigStore
// persists whatever this function returns: if an unusable profile were rewritten to the fallback's
// id, the next save (even an unrelated rename) would permanently reassign the assistant to a
// different vendor, and it would stay there even after the original vendor's key came back. Only
// an absent/unmappable/removed profile id migrates to the fallback profile outright. Exception: a
// known profile with a dataLocation is never served from the fallback (see below).
export const resolveChatConfig = <T extends ModelSelection>(config: T, ctx: ModelContext): T => {
	if (config.vendorAgent) {
		return config
	}
	const implicitPin = legacyProjectPin(config, ctx)
	if (implicitPin) {
		const pinnedModel = usableModel(implicitPin.model, ctx) as CatalogueModel
		const profile = config.model ? legacyProfileId(config.model, ctx) : undefined
		return { ...config, pinned: implicitPin, ...(profile ? { profile } : {}), vendorId: pinnedModel.vendor, model: pinnedModel.providerModel, project: implicitPin.project }
	}
	if (config.pinned) {
		const pinnedModel = usableModel(config.pinned.model, ctx)
		if (pinnedModel) {
			return { ...config, vendorId: pinnedModel.vendor, model: pinnedModel.providerModel, project: config.pinned.project }
		}
		logger.warn("Config {configId} is pinned to unusable model {model} - using its profile instead", config._id ?? "(new)", config.pinned.model)
	}

	// A pinned config never falls back to its (client-controllable) model field - only to its own profile -
	// otherwise a stale pin plus a crafted model could map a save onto a role-restricted profile
	const requestedProfileId = config.profile ?? (config.model && !config.pinned ? legacyProfileId(config.model, ctx) : undefined)
	const knownProfile = requestedProfileId ? ctx.modelConfig.PROFILES.find((p) => p.id === requestedProfileId) : undefined
	const resolved = requestedProfileId ? usableProfile(requestedProfileId, ctx) : null

	if (resolved) {
		return { ...config, profile: resolved.profile.id, vendorId: resolved.model.vendor, model: resolved.model.providerModel, project: DEFAULT_PROJECT_ID }
	}

	// A profile with a dataLocation promises where the data is processed ("Lokal", "Europeisk"). Serving
	// another vendor's model would silently break that promise, so keep the profile's own model - the
	// chat routes then answer 503 (isResolvedModelAvailable) instead of sending data elsewhere.
	if (knownProfile?.dataLocation) {
		const ownModel = Object.hasOwn(ctx.modelConfig.MODELS, knownProfile.model) ? ctx.modelConfig.MODELS[knownProfile.model] : undefined
		if (ownModel && ownModel.status !== "retired") {
			logger.warn("Config {configId} profile {profile} is currently unavailable - not substituting another model because of its data location", config._id ?? "(new)", knownProfile.id)
			return { ...config, profile: knownProfile.id, vendorId: ownModel.vendor, model: ownModel.providerModel, project: DEFAULT_PROJECT_ID }
		}
	}

	const fallback = fallbackProfile(ctx)
	if (!fallback) {
		throw new Error("No usable model profile - check models.config.ts and vendor API keys")
	}

	if (knownProfile) {
		logger.warn("Config {configId} profile {profile} is currently unusable - serving fallback model, keeping profile assignment", config._id ?? "(new)", knownProfile.id)
		return { ...config, profile: knownProfile.id, vendorId: fallback.model.vendor, model: fallback.model.providerModel, project: DEFAULT_PROJECT_ID }
	}

	logger.warn("Config {configId} fell back to default profile (profile: {profile}, model: {model})", config._id ?? "(new)", config.profile ?? "none", config.model ?? "none")
	return { ...config, profile: fallback.profile.id, vendorId: fallback.model.vendor, model: fallback.model.providerModel, project: DEFAULT_PROJECT_ID }
}

// False when resolution kept a model whose vendor is disabled (a dataLocation profile, see above) -
// the chat routes answer 503 rather than calling a vendor that isn't configured. Vendor agents are
// never resolved, so they're left to the vendor as before.
export const isResolvedModelAvailable = (config: Pick<ModelSelection, "vendorId" | "vendorAgent">, ctx: ModelContext): boolean => {
	return Boolean(config.vendorAgent) || ctx.isVendorEnabled(config.vendorId)
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
